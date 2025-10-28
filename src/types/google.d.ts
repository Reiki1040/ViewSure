export {};

declare global {
  namespace google.accounts.id {
    interface CredentialResponse {
      clientId: string;
      credential?: string;
      select_by: string;
    }

    interface PromptMomentNotification {
      isDisplayMoment(): boolean;
      isDisplayed(): boolean;
      isNotDisplayed(): boolean;
      getNotDisplayedReason?(): string;
      isSkippedMoment(): boolean;
      getSkippedReason?(): string;
      getMomentType(): string;
    }

    interface IdConfiguration {
      client_id: string;
      callback: (response: CredentialResponse) => void;
      auto_select?: boolean;
      cancel_on_tap_outside?: boolean;
      prompt_parent_id?: string;
    }
  }

  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize(config: google.accounts.id.IdConfiguration): void;
          prompt(momentListener?: (notification: google.accounts.id.PromptMomentNotification) => void): void;
          renderButton(parent: HTMLElement, options: unknown): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}
