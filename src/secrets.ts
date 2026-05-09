import * as vscode from "vscode";
import type { ProviderId } from "./core/providers";

const SECRET_KEYS: Record<ProviderId, string> = {
  openai: "aiVoiceStudio.openai.apiKey",
  minimax: "aiVoiceStudio.minimax.apiKey",
  mimo: "aiVoiceStudio.mimo.apiKey",
};

const PROMPT_TITLES: Record<ProviderId, string> = {
  openai: "OpenAI API key",
  minimax: "MiniMax API key",
  mimo: "MiMo Token Plan API key (tp-…)",
};

const PLACEHOLDERS: Record<ProviderId, string> = {
  openai: "sk-...",
  minimax: "eyJhbGciOi...",
  mimo: "tp-...",
};

export class SecretsStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(provider: ProviderId): Promise<string | undefined> {
    return this.secrets.get(SECRET_KEYS[provider]);
  }

  async set(provider: ProviderId, key: string): Promise<void> {
    await this.secrets.store(SECRET_KEYS[provider], key);
  }

  async clear(provider: ProviderId): Promise<void> {
    await this.secrets.delete(SECRET_KEYS[provider]);
  }

  async ensure(provider: ProviderId): Promise<string | undefined> {
    const existing = await this.get(provider);
    if (existing) return existing;

    const value = await vscode.window.showInputBox({
      title: PROMPT_TITLES[provider],
      prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
      password: true,
      ignoreFocusOut: true,
      placeHolder: PLACEHOLDERS[provider],
      validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
    });

    if (!value) return undefined;
    const trimmed = value.trim();
    await this.set(provider, trimmed);
    return trimmed;
  }
}
