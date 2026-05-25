import * as vscode from "vscode";

const SECRET_KEY = "aiVoiceStudio.qwen.dashscopeApiKey";

export class SecretsStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<string | undefined> {
    const stored = (await this.secrets.get(SECRET_KEY))?.trim();
    if (stored) return stored;
    const envKey = process.env.DASHSCOPE_API_KEY?.trim();
    return envKey || undefined;
  }

  async set(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, key);
  }

  async clear(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }

  async ensure(): Promise<string | undefined> {
    const existing = await this.get();
    if (existing) return existing;

    const value = await vscode.window.showInputBox({
      title: "DashScope API key",
      prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
      password: true,
      ignoreFocusOut: true,
      placeHolder: "DASHSCOPE_API_KEY / sk-...",
      validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
    });

    if (!value) return undefined;
    const trimmed = value.trim();
    await this.set(trimmed);
    return trimmed;
  }
}
