"use strict";
// #region Imports
import * as vscode from "vscode";

import { PowerlangCompletionProvider } from "./completionProvider";
import { PowerlangColorProvider } from "./colorProvider";
import { PowerlangScraper } from "./powerlangScraper";
import { PowerlangParser } from "./powerlangParser";

import { INTERNAL_NAME } from "./extension";
// #endregion
// #region Constants
const VERSION_KEY: string = `${INTERNAL_NAME}-version`;
// #endregion
// #region Classes
export class PowerlangHandle
{
	// #region Functions
	// #region Public
	public constructor(public readonly context: vscode.ExtensionContext)
	{
		new PowerlangParser(this);
		new PowerlangScraper(this);

		new PowerlangCompletionProvider(this);
		new PowerlangColorProvider(this);

		this._initialize();
	}

	public formatNotification(message: string): string { return `${INTERNAL_NAME}: ${message}`; }

	public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showInformationMessage(this.formatNotification(message), ...items); }
	public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showWarningMessage(this.formatNotification(message), ...items); }
	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showErrorMessage(this.formatNotification(message), ...items); }
	// #endregion
	// #region Private
	private _initialize(): void
	{
		const context: vscode.ExtensionContext = this.context;

		const previousVersion: string | undefined = context.globalState.get(VERSION_KEY);
		const currentVersion: string = context.extension.packageJSON.version;

		context.globalState.update(VERSION_KEY, currentVersion);
		// Undefined means that this just got installed, so it shouldn't show as "updated"
		if (previousVersion !== undefined && previousVersion !== currentVersion)
			this.showInformationMessage(`Updated to v${currentVersion}`);
	}
	// #endregion
	// #endregion
}
// #endregion