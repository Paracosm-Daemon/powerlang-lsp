"use strict";
// #region Imports
import * as vscode from "vscode";

import { PowerlangCompletionProvider } from "./completionProvider";
import { PowerlangScraper } from "./scraper/powerlangScraper";
import { PowerlangParser } from "./parser/powerlangParser";
import { PowerlangColorProvider } from "./colorProvider";
import { INTERNAL_NAME } from "./extension";
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
	}

	public formatNotification(message: string): string { return `${INTERNAL_NAME}: ${message}`; }

	public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showInformationMessage(this.formatNotification(message), ...items); }
	public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showWarningMessage(this.formatNotification(message), ...items); }
	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showErrorMessage(this.formatNotification(message), ...items); }
	// #endregion
	// #endregion
}
// #endregion