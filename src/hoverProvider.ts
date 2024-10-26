"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Modules
import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";

import { REGEX_BREAK, REGEX_PATH_BREAK } from "./parser/powerlangCore";
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
	// #endregion
	// #region Private
	private _registerProviders(): void
	{
		this.handle.context.subscriptions.push(vscode.languages.registerHoverProvider("powerlang", {
			provideHover(document: vscode.TextDocument, position: vscode.Position, _cancel: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover | undefined>
			{
				const lineText: string = document.lineAt(position).text;

				const cursorPosition: number = position.character;
				const cursorRange: string = lineText.substring(0, cursorPosition);
				// Find the latest declaration break so that we can autocomplete assignments/conditionals
				REGEX_PATH_BREAK.lastIndex = 0;

				let breakMatch: RegExpExecArray | null;
				let lastBreak: number = -1;

				while ((breakMatch = REGEX_PATH_BREAK.exec(cursorRange)) !== null) lastBreak = breakMatch.index + breakMatch[ 0 ].length;

				const postRange: string = lastBreak < 0 ? lineText : lineText.slice(lastBreak);
				const pathBreak: number = postRange.search(REGEX_PATH_BREAK);

				const currentRange: string = pathBreak < 0 ? postRange : postRange.substring(0, pathBreak);
				if (cursorRange.startsWith("@flag"))
				{
					console.warn("THIS IS A FLAG");
					return new vscode.Hover(`@flag ${currentRange}`)
				}
				console.log(currentRange);

				return undefined;
			}
		}));
	}
	// #endregion
}
// #endregion