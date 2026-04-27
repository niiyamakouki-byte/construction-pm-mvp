export type Currency = 'JPY' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'SGD';

export function formatCurrency(
  amount: number,
  currency: Currency = 'JPY',
  locale?: string
): string {
  const resolvedLocale = locale ?? getLocaleForCurrency(currency);
  const fractionDigits = currency === 'JPY' ? 0 : 2;
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function getDefaultCurrency(locale: string): Currency {
  const lang = locale.toLowerCase();
  if (lang === 'ja' || lang.startsWith('ja-')) return 'JPY';
  if (lang === 'en-us') return 'USD';
  if (lang === 'en-gb') return 'GBP';
  if (lang === 'en-au') return 'AUD';
  if (lang === 'en-sg' || lang === 'zh-sg') return 'SGD';
  if (lang === 'de' || lang.startsWith('de-')) return 'EUR';
  if (lang === 'fr' || lang.startsWith('fr-')) return 'EUR';
  if (lang === 'es' || lang.startsWith('es-')) return 'EUR';
  if (lang === 'it' || lang.startsWith('it-')) return 'EUR';
  if (lang === 'nl' || lang.startsWith('nl-')) return 'EUR';
  if (lang.startsWith('en-')) return 'USD';
  return 'USD';
}

function getLocaleForCurrency(currency: Currency): string {
  switch (currency) {
    case 'JPY': return 'ja-JP';
    case 'USD': return 'en-US';
    case 'EUR': return 'de-DE';
    case 'GBP': return 'en-GB';
    case 'AUD': return 'en-AU';
    case 'SGD': return 'en-SG';
  }
}
