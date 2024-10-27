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
		// Search for flags first
		// #region Flags
		while ((breakMatch = REGEX_BREAK.exec(cursorRange)) !== null && !cancel.isCancellationRequested) lastBreak = breakMatch.index + breakMatch[ 0 ].length;
		if (cancel.isCancellationRequested) return;
		// Get the start and end of the flag string
		const flagBegin: string = lastBreak < 0 ? lineText : lineText.slice(lastBreak);
		const flagEnd: number = flagBegin.search(REGEX_BREAK);
		// Substring if it breaks (semicolon/newline)
		const flagFull: string = flagEnd < 0 ? flagBegin : flagBegin.substring(0, flagEnd);
		// Make it uppercase, as the @FLAG annotation is in uppercase
		const upperFlag: string = flagFull.toUpperCase();
		const flagIndex: number = upperFlag.indexOf(FLAG_ANNOTATION);
		// Check if it exists, then if the trimmed version (no whitespace) starts with the annotation
		if (flagIndex >= 0 && upperFlag.trimStart().startsWith(FLAG_ANNOTATION))
		{
			const flagOffset: number = Math.max(0, lastBreak);
			// This trims both sides since invalid flags could have spaces at the end
			const flagName: string = flagFull.slice(FLAG_ANNOTATION.length).trim();
			// Range has to be offset by the last break position
			const flagRange: vscode.Range = new vscode.Range(cursorLine, flagOffset + flagIndex, cursorLine, flagOffset + flagFull.length);
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
		let pathMatch: RegExpExecArray | null;
		let pathBreak: number = -1;

		REGEX_PATH_BREAK.lastIndex = 0;
		while ((pathMatch = REGEX_PATH_BREAK.exec(cursorRange)) !== null) pathBreak = pathMatch.index + pathMatch[ 0 ].length;

		const pathBegin: string = pathBreak < 0 ? lineText : lineText.slice(pathBreak);
		const pathEnd: number = pathBegin.search(REGEX_PATH_BREAK);

		const fullPath: string = pathEnd < 0 ? pathBegin : pathBegin.substring(0, pathEnd);
		if (fullPath.length === 0) return;

		const cursorTraversals: number = (pathEnd > cursorRange.length ? cursorRange : fullPath).split(".").length;
		if (cursorTraversals === 0) return;

		const pathTraversal: string[] = fullPath.split(".");
		const globalLibrary: string = pathTraversal[ 0 ];

		const totalTraversals: number = pathTraversal.length;
		const pathOffset: number = Math.max(0, pathBreak);
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
			new vscode.Range(cursorLine, pathOffset, cursorLine, pathOffset + fullPath.length)
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