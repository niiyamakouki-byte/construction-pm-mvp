function buildRedirectUrl(hash: string): string {
  if (typeof window === "undefined") {
    return hash;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = hash;
  return url.toString();
}

export function getOAuthRedirectUrl(): string {
  return buildRedirectUrl("");
}

export function getPasswordRecoveryRedirectUrl(): string {
  return buildRedirectUrl("/account");
}
