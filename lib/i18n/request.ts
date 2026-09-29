import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, getIntlLocale, LOCALE_COOKIE, locales } from './config';
import { getConlangMessages, mergeMessages } from './conlang-messages';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value || defaultLocale;

  let messages: Record<string, any>;
  
  // Try to load base English translations
  try {
    messages = (await import(`../../messages/en.json`)).default;
  } catch (error) {
    messages = {};
    console.error('Failed to load English messages', error);
  }

  // If locale specifies a conlang, load it and merge
  if (localeCookie.startsWith('conlang:')) {
    const languageId = localeCookie.split(':')[1];
    if (languageId) {
      const conlangMessages = await getConlangMessages(languageId);
      messages = mergeMessages(messages, conlangMessages);
    }
    // Conlang strings merged over English; formatting (plurals, numbers) follows English.
    return {
      locale: getIntlLocale(localeCookie),
      messages
    };
  }

  // Try to load natural language translations if it's not 'en' (only for shipped locales —
  // the cookie is user-controlled).
  if (localeCookie !== 'en' && (locales as readonly string[]).includes(localeCookie)) {
      try {
        const natMessages = (await import(`../../messages/${localeCookie}.json`)).default;
        messages = mergeMessages(messages, natMessages);
      } catch (error) {
          // Fallback to English
      }
  }

  // A valid BCP-47 tag for ICU/Intl ("free-ru" → "ru"); the switcher reads the raw cookie itself.
  return {
    locale: getIntlLocale(localeCookie),
    messages
  };
});
