//! rustls client configuration for `sslmode=require` database URLs.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider};
use rustls::pki_types::pem::PemObject;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};
use tokio_postgres_rustls::MakeRustlsConnect;

#[derive(Debug, thiserror::Error)]
pub enum TlsSetupError {
    #[error("could not configure TLS: {0}")]
    Rustls(#[from] rustls::Error),
    #[error("could not read CA certificates from {path}: {reason}")]
    CaFile { path: PathBuf, reason: String },
    #[error("{0} contains no usable CA certificate")]
    NoCaCertificates(PathBuf),
}

/// Builds the connector. With `verify`, the server certificate chain and host
/// name are checked against the Mozilla roots plus `ca_file`. Without it, the
/// connection is encrypted but the certificate is not checked (libpq/Prisma
/// `sslmode=require` semantics); handshake signatures are still verified.
pub fn rustls_connector(
    verify: bool,
    ca_file: Option<&Path>,
) -> Result<MakeRustlsConnect, TlsSetupError> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let builder = ClientConfig::builder_with_provider(Arc::clone(&provider))
        .with_safe_default_protocol_versions()?;
    let config = if verify {
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        if let Some(path) = ca_file {
            add_ca_file(&mut roots, path)?;
        }
        builder.with_root_certificates(roots).with_no_client_auth()
    } else {
        builder
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(EncryptOnlyVerifier { provider }))
            .with_no_client_auth()
    };
    Ok(MakeRustlsConnect::new(config))
}

fn add_ca_file(roots: &mut RootCertStore, path: &Path) -> Result<(), TlsSetupError> {
    let read_error = |reason: String| TlsSetupError::CaFile {
        path: path.to_path_buf(),
        reason,
    };
    let certs: Vec<CertificateDer<'static>> = CertificateDer::pem_file_iter(path)
        .map_err(|err| read_error(err.to_string()))?
        .collect::<Result<_, _>>()
        .map_err(|err| read_error(err.to_string()))?;
    let (added, _ignored) = roots.add_parsable_certificates(certs);
    if added == 0 {
        return Err(TlsSetupError::NoCaCertificates(path.to_path_buf()));
    }
    Ok(())
}

/// Accepts any server certificate but still checks the handshake signatures.
#[derive(Debug)]
struct EncryptOnlyVerifier {
    provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for EncryptOnlyVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(
            message,
            cert,
            dss,
            &self.provider.signature_verification_algorithms,
        )
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(
            message,
            cert,
            dss,
            &self.provider.signature_verification_algorithms,
        )
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.provider
            .signature_verification_algorithms
            .supported_schemes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_verifying_and_encrypt_only_connectors() {
        assert!(rustls_connector(true, None).is_ok());
        assert!(rustls_connector(false, None).is_ok());
    }

    #[test]
    fn reports_missing_ca_file() {
        let err = rustls_connector(true, Some(Path::new("/nonexistent/ca.pem")))
            .err()
            .expect("missing file must fail");
        assert!(err.to_string().contains("/nonexistent/ca.pem"), "{err}");
    }
}
