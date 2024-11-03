"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Modules
import { PowerlangFunctionDescriptions, PowerlangHandle } from "./powerlangHandle";
import { PowerlangAPI, PowerlangParameter } from "./powerlangAPI";
import { PowerlangProvider } from "./powerlangProvider";

import { FLAG_ANNOTATION, REGEX_BREAK, REGEX_PATH_BREAK } from "./parser/powerlangCore";
// #endregion
// #region Classes
export class PowerlangHoverProvider extends PowerlangProvider
{
	// #region Public
	public constructor(handle: PowerlangHandle)
	{
		super(handle);
		this._registerProviders();
	}
	public provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken): vscode.ProviderResult<vscode.SignatureHelp>
	{
		return undefined;
	}
	// #endregion
	// #region Private
	private _registerProviders(): void
	{
		this.handle.context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(
			"powerlang",
			this
		));
	}
	// #endregion
}
// #endregion