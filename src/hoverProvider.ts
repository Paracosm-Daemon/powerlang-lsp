"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Modules
import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";

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
	// #endregion
	// #region Private
	private _registerProviders(): void
	{
		const provider: PowerlangHoverProvider = this;
		this.handle.context.subscriptions.push(vscode.languages.registerHoverProvider("powerlang", {
			provideHover(document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
			{
				const lineText: string = document.lineAt(position).text;

				const cursorPosition: number = position.character;
				const cursorRange: string = lineText.substring(0, cursorPosition);
				// Find the latest declaration break so that we can autocomplete assignments/conditionals
				let breakMatch: RegExpExecArray | null;
				let lastBreak: number = -1;

				REGEX_BREAK.lastIndex = 0;
				// Search for flags first
				// #region Flags
				while ((breakMatch = REGEX_BREAK.exec(cursorRange)) !== null && !cancel.isCancellationRequested) lastBreak = breakMatch.index + breakMatch[ 0 ].length;
				if (cancel.isCancellationRequested) return undefined;

				const flagBegin: string = lastBreak < 0 ? lineText : lineText.slice(lastBreak);

				const termEnd: number = flagBegin.search(REGEX_BREAK);
				const flagFull: string = termEnd < 0 ? flagBegin : flagBegin.substring(0, termEnd);

				const upperFlag: string = flagFull.toUpperCase();
				const flagIndex: number = upperFlag.indexOf(FLAG_ANNOTATION);

				if (flagIndex >= 0 && upperFlag.trimStart().startsWith(FLAG_ANNOTATION))
				{
					const flagOffset: number = Math.max(0, lastBreak);
					const flagName: string = flagFull.slice(FLAG_ANNOTATION.length).trimStart();

					const flagRange: vscode.Range = new vscode.Range(position.line, flagOffset + flagIndex, position.line, flagOffset + flagFull.length);
					const flagTitle: vscode.MarkdownString = new vscode.MarkdownString(`\`\`\`\n@flag ${flagName}\n\`\`\``);

					if (!(flagName in provider.handle.flagAnnotations))
						return new vscode.Hover(
							flagTitle,
							flagRange
						);

					return new vscode.Hover(
						[
							flagTitle,
							new vscode.MarkdownString(provider.handle.flagAnnotations[ flagName ])
						],
						flagRange
					);
				}
				// #endregion
				// #region Variables
				// let pathMatch: RegExpExecArray | null;
				// let pathBreak: number = -1;

				// REGEX_PATH_BREAK.lastIndex = 0;
				// while ((pathMatch = REGEX_PATH_BREAK.exec(cursorRange)) !== null) pathBreak = pathMatch.index + pathMatch[ 0 ].length;

				// const postRange: string = pathBreak < 0 ? lineText : lineText.slice(pathBreak);
				// const pathStart: number = postRange.search(REGEX_PATH_BREAK);
				// #endregion
				return undefined;
			}
		}));
	}
	// #endregion
}
// #endregion