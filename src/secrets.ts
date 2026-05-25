import * as vscode from "vscode";
import type { ProviderId } from "./core/providers";

const SECRET_KEYS: Record<ProviderId, string> = {
  openai: "aiVoiceStudio.openai.apiKey",
  mimo: "aiVoiceStudio.mimo.apiKey",
  gemini: "aiVoiceStudio.gemini.apiKey",
  qwen: "aiVoiceStudio.qwen.dashscopeApiKey",
};

const ENV_FALLBACKS: Partial<Record<ProviderId, string[]>> = {
  qwen: ["DASHSCOPE_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};

const PROMPT_TITLES: Record<ProviderId, string> = {
  openai: "OpenAI API key",
  mimo: "MiMo Token Plan API key (tp-…)",
  gemini: "Google AI Studio API key",
  qwen: "DashScope API key",
};

const PLACEHOLDERS: Record<ProviderId, string> = {
  openai: "sk-...",
  mimo: "tp-...",
  gemini: "AIzaSy...",
  qwen: "DASHSCOPE_API_KEY / sk-...",
};

export class SecretsStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(provider: ProviderId): Promise<string | undefined> {
    const stored = (await this.secrets.get(SECRET_KEYS[provider]))?.trim();
    if (stored) return stored;
    const envNames = ENV_FALLBACKS[provider] ?? [];
    for (const name of envNames) {
      const value = process.env[name]?.trim();
      if (value) return value;
    }
    return undefined;
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
    if (!trimmed) return undefined;
    await this.set(provider, trimmed);
    return trimmed;
  }
}
