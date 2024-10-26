"use strict";
// #region Imports
import * as vscode from "vscode";
import * as fs from "fs";
// #endregion
// #region Modules
import { PowerlangAPI, PowerlangGlobal } from "./powerlangAPI";
import { PowerlangProvider } from "./powerlangProvider";

import { LOGIC_GATES, VALID_FLAGS, REGEX_FLAG, REGEX_BREAK, REGEX_VARIABLE, REGEX_ASSIGNMENT, REGEX_CONDITIONALS } from "./parser/powerlangCore";
import { PowerlangHandle } from "./powerlangHandle";
// #endregion
// #region Types
type PowerlangLibrary = { [ library: string ]: vscode.CompletionItem[]; };
// #endregion
// #region Constants
const FLAG_ANNOTATION_ITEMS: vscode.CompletionItem[] = [ new vscode.CompletionItem("flag", vscode.CompletionItemKind.Enum) ];
const TABLELOOP_ITEMS: vscode.CompletionItem[] = [ new vscode.CompletionItem("in", vscode.CompletionItemKind.Keyword) ];

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
	new vscode.CompletionItem("game", vscode.CompletionItemKind.Module)
];

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
// #endregion
// #region Classes
export class PowerlangCompletionProvider extends PowerlangProvider
{
	// #region Variables
	private _globalItems: vscode.CompletionItem[];
	private _libraryItems: PowerlangLibrary;
	// #endregion
	// #region Functions
	// #region Overrides
	public constructor(handle: PowerlangHandle)
	{
		super(handle);

		this._libraryItems = {};
		this._globalItems = [];

		this._registerEvents();
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
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, cancel: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionList>
			{
				const cursorRange: string = document.lineAt(position).text.substring(0, position.character);
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
	// TODO: I can make this a little more complex, I just need to figure out variable autocomplete (tokenizer!!!)
	private _includeTableloop(beforeCursor: string): boolean { return beforeCursor.startsWith("tableloop"); }
	// (if | while) and | or | not
	private _includeConditionals(beforeCursor: string): boolean { return beforeCursor.search(REGEX_CONDITIONALS) >= 0; }
	// variable = nil | true | false
	private _includeBooleans(beforeCursor: string): boolean { return beforeCursor.search(REGEX_ASSIGNMENT) >= 0; }
	// For local scopes
	private _provideScopedCompletion(provider: PowerlangCompletionProvider, document: vscode.TextDocument, position: vscode.Position, _cancel: vscode.CancellationToken, context: vscode.CompletionContext, term: string): vscode.CompletionList
	{
		const completionList = new vscode.CompletionList();

		if (provider._includeTableloop(term)) completionList.items.push(...TABLELOOP_ITEMS);
		else if (provider._includeConditionals(term)) completionList.items.push(...BOOLEAN_ITEMS, ...OPERATION_ITEMS);
		else if (provider._includeBooleans(term)) completionList.items.push(...BOOLEAN_ITEMS);
		else completionList.items.push(...provider._globalItems);

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
				if (globalVariable in provider._libraryItems) completionList.items.push(...provider._libraryItems[ globalVariable ]);
			}
		}
		return completionList;
	}
	// For flags
	private _provideFlagCompletion(provider: PowerlangCompletionProvider, _document: vscode.TextDocument, _position: vscode.Position, _cancel: vscode.CancellationToken, _context: vscode.CompletionContext, term: string): vscode.CompletionList
	{
		if (provider._includeFlagAnnotation(term))
		{
			if (provider._includeFlags(term)) return new vscode.CompletionList(FLAG_ITEMS);
			return new vscode.CompletionList(FLAG_ANNOTATION_ITEMS);
		}
		return new vscode.CompletionList();
	}

	private _loadGlobals(): void
	{
		const powerlangLibraries: PowerlangGlobal[] = this.handle.globalLibraries;
		const powerlangGlobals: PowerlangAPI[] = this.handle.globalFunctions;
		// Add all global libraries from the globals.json file into autocomplete
		this._globalItems = [
			...GLOBAL_ITEMS,
			...powerlangGlobals.map(
				(globalFunction: PowerlangAPI): vscode.CompletionItem =>
					new vscode.CompletionItem(globalFunction.name, vscode.CompletionItemKind.Function)
			),
			...powerlangLibraries.map(
				(globalLibrary: PowerlangGlobal): vscode.CompletionItem =>
					new vscode.CompletionItem(globalLibrary.name, vscode.CompletionItemKind.Module)
			)
		];
		this._libraryItems = powerlangLibraries.reduce((result: PowerlangLibrary, globalLibrary: PowerlangGlobal): PowerlangLibrary => ({
			[ globalLibrary.name ]: globalLibrary.api.map((globalAPI: PowerlangAPI): vscode.CompletionItem =>
				new vscode.CompletionItem(globalAPI.name, vscode.CompletionItemKind.Function)
			),
			...result
		}), {});
	}

	private _registerProviders(): void
	{
		PowerlangCompletionProvider._registerProvider(this, this._provideFlagCompletion, "@", " ");
		PowerlangCompletionProvider._registerProvider(this, this._provideLibraryCompletion, ".");
		PowerlangCompletionProvider._registerProvider(this, this._provideScopedCompletion);
	}
	private _registerEvents(): void
	{
		this.handle.globalsRegenerated(this._loadGlobals, this);
	}
	// #endregion
	// #endregion
}
// #endregion