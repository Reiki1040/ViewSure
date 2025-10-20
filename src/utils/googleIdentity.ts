const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let loadingPromise: Promise<void> | null = null;

export const loadGoogleIdentityServices = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Identity Services script')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));

    document.head.appendChild(script);
  });

  return loadingPromise;
};

type CredentialPayload = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
};

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : normalized + '='.repeat(4 - pad);
  try {
    return atob(padded);
  } catch (error) {
    throw new Error('Invalid base64url string');
  }
};

export const decodeGoogleCredential = (credential: string) => {
  const parts = credential.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid credential format');
  }
  const payloadSegment = parts[1];
  const decoded = decodeBase64Url(payloadSegment);
  const payload = JSON.parse(decoded) as CredentialPayload;

  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    givenName: payload.given_name,
    familyName: payload.family_name
  };
};
