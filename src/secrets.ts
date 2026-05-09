import * as vscode from "vscode";

const OPENAI_API_KEY = "aiVoiceStudio.openai.apiKey";

export class SecretsStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getOpenAIKey(): Promise<string | undefined> {
    return this.secrets.get(OPENAI_API_KEY);
  }

  async setOpenAIKey(key: string): Promise<void> {
    await this.secrets.store(OPENAI_API_KEY, key);
  }

  async clearOpenAIKey(): Promise<void> {
    await this.secrets.delete(OPENAI_API_KEY);
  }

  async ensureOpenAIKey(): Promise<string | undefined> {
    const existing = await this.getOpenAIKey();
    if (existing) return existing;

    const value = await vscode.window.showInputBox({
      title: "OpenAI API key",
      prompt: "Enter your OpenAI API key. It will be stored in VS Code SecretStorage.",
      password: true,
      ignoreFocusOut: true,
      placeHolder: "sk-...",
      validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
    });

    if (!value) return undefined;
    const trimmed = value.trim();
    await this.setOpenAIKey(trimmed);
    return trimmed;
  }
}
