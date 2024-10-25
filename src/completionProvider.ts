"use strict";
// #region Imports
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";

import { LOGIC_GATES, VALID_FLAGS } from "./parser/powerlangCore";
// #endregion
// #region Types
type PowerlangParameter = {
	name: string,
	type: string;
};
type PowerlangAPI = {
	parameters: PowerlangParameter[];
	return: string[];

	description?: string;
	name: string;
};
type PowerlangGlobal = {
	api: PowerlangAPI[];
	name: string,
};
type PowerlangLibrary = { [ library: string ]: vscode.CompletionItem[]; };
// #endregion
// #region Constants
import POWERLANG_LIBRARIES from "../resources/libraries.json";
import POWERLANG_GLOBALS from "../resources/globals.json";

const REGEX_ASSIGNMENT: RegExp = /([A-Z_]+[A-Z0-9_-]*)\s*=/i;
const REGEX_CONDITIONALS: RegExp = /^(IF|WHILE)/i;

const REGEX_VARIABLE: RegExp = /[A-Z_]+[A-Z0-9_-]*/i;

const REGEX_FLAG: RegExp = /@FLAG\s+/i;
const REGEX_BREAK: RegExp = /[\n;]/g;

const FLAG_ANNOTATION_ITEM: vscode.CompletionItem = new vscode.CompletionItem("flag", vscode.CompletionItemKind.Enum);
const OPERATION_ITEMS: vscode.CompletionItem[] = LOGIC_GATES.map(
	(value: string): vscode.CompletionItem =>
		new vscode.CompletionItem(value, vscode.CompletionItemKind.Keyword)
);
const FLAG_ITEMS: vscode.CompletionItem[] = VALID_FLAGS.map(
	(value: string): vscode.CompletionItem =>
		new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember)
);

const BOOLEAN_ITEMS: vscode.CompletionItem[] = [
	new vscode.CompletionItem("false", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("true", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("nil", vscode.CompletionItemKind.Keyword)
];
// Add all global libraries from the globals.json file into autocomplete
const GLOBAL_ITEMS: vscode.CompletionItem[] = [
	new vscode.CompletionItem("tableloop", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("for", vscode.CompletionItemKind.Keyword),

	new vscode.CompletionItem("function", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("thread", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("event", vscode.CompletionItemKind.Keyword),

	new vscode.CompletionItem("while", vscode.CompletionItemKind.Keyword),
	new vscode.CompletionItem("if", vscode.CompletionItemKind.Keyword),

	new vscode.CompletionItem("workspace", vscode.CompletionItemKind.Module),
	new vscode.CompletionItem("script", vscode.CompletionItemKind.Module),
	new vscode.CompletionItem("game", vscode.CompletionItemKind.Module),

	...POWERLANG_GLOBALS.map(
		(globalFunction: PowerlangAPI): vscode.CompletionItem =>
			new vscode.CompletionItem(globalFunction.name, vscode.CompletionItemKind.Function)
	),
	...POWERLANG_LIBRARIES.map(
		(globalLibrary: PowerlangGlobal): vscode.CompletionItem =>
			new vscode.CompletionItem(globalLibrary.name, vscode.CompletionItemKind.Module)
	)
];
const LIBRARY_ITEMS: PowerlangLibrary = POWERLANG_LIBRARIES.reduce((result: PowerlangLibrary, globalLibrary: PowerlangGlobal): PowerlangLibrary => ({
	[ globalLibrary.name ]: globalLibrary.api.map((globalAPI: PowerlangAPI): vscode.CompletionItem =>
		new vscode.CompletionItem(globalAPI.name, vscode.CompletionItemKind.Function)
	),
	...result
}), {});
//{
// ...POWERLANG_LIBRARIES.map((globalLibrary: PowerlangGlobal): vscode.CompletionItem[] => {
// 	{ [globalLibrary.name]: globalLibrary.api.map((libraryFunction: PowerlangAPI): vscode.CompletionItem =>
// 		new vscode.CompletionItem(libraryFunction.name, vscode.CompletionItemKind.Function)
// 	) }
// })
//}
// #endregion
// #region Classes
export class PowerlangCompletionProvider extends PowerlangProvider
{
	// #region Overrides
	public constructor(handle: PowerlangHandle)
	{
		super(handle);
		this._registerProviders();
	}
	// #endregion
	// #region Static
	private static _registerProvider(provider: PowerlangCompletionProvider, callback: (provider: PowerlangCompletionProvider, document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken, context: vscode.CompletionContext, term: string) => vscode.CompletionList, ...triggerCharacters: string[]): void
	{
		const triggerCharacterRegEx: RegExp | undefined = triggerCharacters.length > 0
			? new RegExp(triggerCharacters.join("") + "$")
			: undefined;
		provider.handle.context.subscriptions.push(vscode.languages.registerCompletionItemProvider("powerlang", {
			resolveCompletionItem(item): vscode.ProviderResult<vscode.CompletionItem> { return item; },
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionList>
			{
				const cursorRange = document.lineAt(position).text.substring(0, position.character);
				// Find the latest declaration break so that we can autocomplete assignments/conditionals
				REGEX_BREAK.lastIndex = 0;

				let breakMatch: RegExpExecArray | null;
				let lastBreak: number = -1;

				while ((breakMatch = REGEX_BREAK.exec(cursorRange)) !== null) lastBreak = breakMatch.index + breakMatch[ 0 ].length;
				const beforeCursor: string = lastBreak < 0 ? cursorRange : cursorRange.slice(lastBreak);

				if (triggerCharacterRegEx !== undefined && context.triggerCharacter === undefined && beforeCursor.match(triggerCharacterRegEx)?.index === 0) return;
				return callback(provider, document, position, cancel, context, beforeCursor);
			}
		}, ...triggerCharacters));
	}
	// #endregion
	// #region Private
	private _includeFlagAnnotation(beforeCursor: string): boolean { return beforeCursor.trimStart().startsWith("@"); }
	private _includeFlags(beforeCursor: string): boolean { return beforeCursor.search(REGEX_FLAG) >= 0; }
	// (if | while) and | or | not
	private _includeConditionals(beforeCursor: string): boolean { return beforeCursor.search(REGEX_CONDITIONALS) >= 0; }
	// variable = nil | true | false
	private _includeBooleans(beforeCursor: string): boolean { return beforeCursor.search(REGEX_ASSIGNMENT) >= 0; }
	// For local scopes
	private _provideScopedCompletion(provider: PowerlangCompletionProvider, document: vscode.TextDocument, position: vscode.Position, _cancel: vscode.CancellationToken, context: vscode.CompletionContext, term: string): vscode.CompletionList
	{
		const completionList = new vscode.CompletionList();

		if (provider._includeConditionals(term)) completionList.items.push(...BOOLEAN_ITEMS, ...OPERATION_ITEMS);
		else if (provider._includeBooleans(term)) completionList.items.push(...BOOLEAN_ITEMS);
		else completionList.items.push(...GLOBAL_ITEMS);

		return completionList;
	}
	// For globals
	private _provideLibraryCompletion(provider: PowerlangCompletionProvider, document: vscode.TextDocument, position: vscode.Position, _cancel: vscode.CancellationToken, context: vscode.CompletionContext, term: string): vscode.CompletionList
	{
		const completionList = new vscode.CompletionList();

		const lastPeriod: number = term.lastIndexOf(".");
		const firstPeriod: number = term.indexOf(".");
		// Only resolving the first period, no need to go further for now
		if (firstPeriod >= 0 && firstPeriod === lastPeriod)
		{
			const variablesBefore: RegExpMatchArray | null = term.substring(0, firstPeriod).match(REGEX_VARIABLE);
			if (variablesBefore !== null)
			{
				const globalVariable: string = variablesBefore[ 0 ];
				if (globalVariable in LIBRARY_ITEMS) completionList.items.push(...LIBRARY_ITEMS[globalVariable]);
			}
		}
		return completionList;
	}
	// For flags
	private _provideFlagCompletion(provider: PowerlangCompletionProvider, _document: vscode.TextDocument, _position: vscode.Position, _cancel: vscode.CancellationToken, _context: vscode.CompletionContext, term: string): vscode.CompletionList
	{
		const completionList = new vscode.CompletionList();
		if (provider._includeFlagAnnotation(term))
		{
			if (provider._includeFlags(term)) completionList.items.push(...FLAG_ITEMS);
			else completionList.items.push(FLAG_ANNOTATION_ITEM);
		}
		return completionList;
	}

	private _registerProviders(): void
	{
		PowerlangCompletionProvider._registerProvider(this, this._provideFlagCompletion, "@", " ");
		PowerlangCompletionProvider._registerProvider(this, this._provideLibraryCompletion, ".");
		PowerlangCompletionProvider._registerProvider(this, this._provideScopedCompletion);
	}
	// #endregion
}
// #endregion