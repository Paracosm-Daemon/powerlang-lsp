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
	public provideHover(document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
	{
		const lineText: string = document.lineAt(position).text;
		if (lineText.length === 0) return;

		const cursorPosition: number = position.character;
		const cursorLine: number = position.line;

		const cursorRange: string = lineText.substring(0, cursorPosition);
		// Find the latest declaration break so that we can autocomplete assignments/conditionals
		let breakMatch: RegExpExecArray | null;
		let lastBreak: number = -1;

		REGEX_BREAK.lastIndex = 0;

		while ((breakMatch = REGEX_BREAK.exec(cursorRange)) !== null && !cancel.isCancellationRequested) lastBreak = breakMatch.index + breakMatch[ 0 ].length;
		if (cancel.isCancellationRequested) return;
		// Get the start and end of the string
		const pathBegin: string = lastBreak < 0 ? lineText : lineText.slice(lastBreak);
		const pathEnd: number = pathBegin.search(REGEX_BREAK);
		// Substring if it breaks (semicolon/newline)
		const pathFull: string = pathEnd < 0 ? pathBegin : pathBegin.substring(0, pathEnd);
		if (pathFull.length === 0) return;

		const pathOffset: number = Math.max(0, lastBreak);
		// Search for flags first
		// #region Flags
		// Make it uppercase, as the @FLAG annotation is in uppercase
		const upperFlag: string = pathFull.toUpperCase();
		const flagIndex: number = upperFlag.indexOf(FLAG_ANNOTATION);
		// Check if it exists, then if the trimmed version (no whitespace) starts with the annotation
		if (flagIndex >= 0 && upperFlag.trimStart().startsWith(FLAG_ANNOTATION))
		{
			// This trims both sides since invalid flags could have spaces at the end
			const flagName: string = pathFull.slice(FLAG_ANNOTATION.length).trim();
			// Range has to be offset by the last break position
			const flagRange: vscode.Range = new vscode.Range(cursorLine, pathOffset + flagIndex, cursorLine, pathOffset + pathFull.length);
			// Codeblocks markdown, has Powerlang syntax highlighting
			const flagTitle: vscode.MarkdownString = new vscode.MarkdownString(`\`\`\`\n@flag ${flagName}\n\`\`\``);
			// Check if it exists as a flag before inserting its description
			if (!(flagName in this.handle.flagAnnotations))
				return new vscode.Hover(
					flagTitle,
					flagRange
				);

			return new vscode.Hover(
				[
					flagTitle,
					new vscode.MarkdownString(this.handle.flagAnnotations[ flagName ])
				],
				flagRange
			);
		}
		// #endregion
		// #region Paths
		REGEX_PATH_BREAK.lastIndex = 0;
		lastBreak = -1;
		// TODO: FIX THIS
		while ((breakMatch = REGEX_PATH_BREAK.exec(pathFull)) !== null && !cancel.isCancellationRequested) lastBreak = breakMatch.index + breakMatch[ 0 ].length;
		if (cancel.isCancellationRequested) return;

		console.warn(lastBreak, pathFull);

		const traversalBegin: string = lastBreak < 0 ? pathFull : pathFull.slice(lastBreak);
		const traversalEnd: number = traversalBegin.search(REGEX_PATH_BREAK);

		const traversalPath: string = traversalEnd < 0 ? traversalBegin : traversalBegin.substring(0, traversalEnd);
		const cursorTraversals: number = (traversalEnd > (cursorPosition - pathOffset) ? lineText.substring(pathOffset, cursorPosition) : traversalPath).split(".").length;
		console.warn(cursorTraversals, traversalBegin);
		if (cursorTraversals === 0) return;

		const pathTraversal: string[] = traversalPath.split(".");
		const globalLibrary: string = pathTraversal[ 0 ];

		const totalTraversals: number = pathTraversal.length;
		// This is either a global or just a variable
		// #region Single destination
		if (totalTraversals === 1)
		{
			const pathRange: vscode.Range = new vscode.Range(cursorLine, pathOffset, cursorLine, pathOffset + globalLibrary.length);
			if (globalLibrary in this.handle.globalFunctionDescriptions)
			{
				const apiReference: PowerlangAPI = this.handle.globalFunctionDescriptions[ globalLibrary ];
				const functionParameters: string = apiReference.parameters.map((parameter: PowerlangParameter): string =>
				{
					const parameterDefault: string | undefined = parameter.default;
					return parameterDefault === undefined
						? `${parameter.name}: ${parameter.type}`
						: `${parameter.name}: ${parameter.type} = ${parameterDefault}`;
				}).join(", ");

				const functionTitle: string = apiReference.return.length === 0
					? `${globalLibrary}(${functionParameters})`
					: `${globalLibrary}(${functionParameters}) -> ${apiReference.return.join(", ")}`;
				return new vscode.Hover(
					[
						`\`\`\`\n${functionTitle}\n\`\`\``,
						new vscode.MarkdownString(apiReference.description)
					],
					pathRange
				);
			}
			return new vscode.Hover(
				new vscode.MarkdownString(`\`\`\`\n${globalLibrary}\n\`\`\``),
				pathRange
			);
		}
		// #endregion
		// #region Class path
		if (!(globalLibrary in this.handle.globalLibraryDescriptions)) return;
		if (totalTraversals !== 2) return;

		const libraryAPI: PowerlangFunctionDescriptions = this.handle.globalLibraryDescriptions[ globalLibrary ];
		const functionName: string = pathTraversal[ 1 ];

		if (!(functionName in libraryAPI)) return;
		// TODO: I can strip this really easily and make it less boilerplate, I'm just lazy atm
		const apiReference: PowerlangAPI = libraryAPI[ functionName ];
		const functionParameters: string = apiReference.parameters.map((parameter: PowerlangParameter): string =>
		{
			const parameterDefault: string | undefined = parameter.default;
			return parameterDefault === undefined
				? `${parameter.name}: ${parameter.type}`
				: `${parameter.name}: ${parameter.type} = ${parameterDefault}`;
		}).join(", ");

		const functionTitle: string = apiReference.return.length === 0
			? `${functionName}(${functionParameters})`
			: `${functionName}(${functionParameters}) -> ${apiReference.return.join(", ")}`;
		return new vscode.Hover(
			[
				`\`\`\`\n${globalLibrary}.${functionTitle}\n\`\`\``,
				new vscode.MarkdownString(apiReference.description)
			],
			new vscode.Range(cursorLine, pathOffset, cursorLine, pathOffset + pathFull.length)
		);
		// #endregion
		// #endregion
	}
	// #endregion
	// #region Private
	private _registerProviders(): void
	{
		this.handle.context.subscriptions.push(vscode.languages.registerHoverProvider(
			"powerlang",
			this
		));
	}
	// #endregion
}
// #endregion