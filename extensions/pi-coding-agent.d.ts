declare module "@mariozechner/pi-coding-agent" {
	export interface ExtensionAPI {
		registerProvider(name: string, config: any): void;
		registerCommand(
			name: string,
			options: {
				description: string;
				handler: (args: unknown, ctx: any) => Promise<void> | void;
			},
		): void;
		on(event: string, handler: (event: unknown, ctx: any) => Promise<void> | void): void;
	}
}
