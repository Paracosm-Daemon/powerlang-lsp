"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Modules
import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";

import { PowerlangCore } from "./parser/powerlangCore";
// #endregion
// #region Classes
export class PowerlangParser extends PowerlangProvider
{
	// #region Variables
	// #region Private
	private _editTimeouts: Map<vscode.TextDocument, NodeJS.Timeout>;
	private _visibleEditors: Map<vscode.TextEditor, boolean>;

	private _parsedFiles: { [ path: string ]: PowerlangCore; };
	// #endregion
	// #endregion
	// #region Functions
	// #region Static
	public static canParseDocument(document: vscode.TextDocument): boolean
	{
		return !document.isClosed
			&& document.lineCount !== 0
			&& (document.uri.scheme === "file" || document.isUntitled)
			&& (document.languageId === "powerlang");
	}
	// #endregion
	// #region Public
	public constructor(handle: PowerlangHandle)
	{
		super(handle);

		this._visibleEditors = new Map();
		this._editTimeouts = new Map();

		this._parsedFiles = {};
		this._registerEvents();
	}
	/// Parses the document if it hasn't been parsed already
	public parseFile(document: vscode.TextDocument): PowerlangCore
	{
		const documentUri: vscode.Uri = document.uri;
		const documentPath: string = documentUri.fsPath;

		if (documentPath in this._parsedFiles) return this._parsedFiles[ documentPath ];
		return this._parseFile(documentUri, document.getText());
	}
	// #endregion
	// #region Private
	private _parseFile(uri: vscode.Uri, body: string): PowerlangCore
	{
		return this._parsedFiles[ uri.fsPath ] = new PowerlangCore(this.handle, body);
	}
	private _parseEditedDocument(document: vscode.TextDocument): PowerlangCore | undefined
	{
		const documentUri: vscode.Uri = document.uri;
		if (documentUri.scheme !== "file") return;

		const documentPath: string = documentUri.fsPath;
		if (!PowerlangParser.canParseDocument(document))
		{
			if (documentPath in this._parsedFiles) delete this._parsedFiles[ documentPath ];
			return;
		}
		return this._parseFile(documentUri, document.getText());
	}

	private _onActiveEditorChanged(textEditor: vscode.TextEditor | undefined): void
	{
		if (textEditor === undefined || !PowerlangParser.canParseDocument(textEditor.document)) return;
		this.parseFile(textEditor.document);
	}
	private _onVisibleEditorChanged(textEditors: readonly vscode.TextEditor[]): void
	{
		const nowVisible: Map<vscode.TextEditor, boolean> = new Map();
		textEditors.forEach(textEditor =>
		{
			if (!this._parseEditedDocument(textEditor.document)) return;
			nowVisible.set(textEditor, true);
		});
		this._visibleEditors.forEach((_, textEditor): void =>
		{
			const documentPath: string = textEditor.document.uri.fsPath;

			if (nowVisible.has(textEditor) || !(documentPath in this._parsedFiles)) return;
			delete this._parsedFiles[ documentPath ];
		});
		this._visibleEditors = nowVisible;
	}

	private _onDocumentEdited(textEvent: vscode.TextDocumentChangeEvent): void
	{
		const textDocument: vscode.TextDocument = textEvent.document;
		if (this._editTimeouts.has(textDocument)) clearTimeout(this._editTimeouts.get(textDocument));

		const timeoutDuration: number = vscode.workspace.getConfiguration().get<number>("powerlang.parser.timeoutDuration") ?? 500.;
		this._editTimeouts.set(textDocument, setTimeout((): void =>
		{
			const documentUri: vscode.Uri = textDocument.uri;
			const documentPath: string = documentUri.fsPath;
			// Remove the file
			if (!PowerlangParser.canParseDocument(textDocument))
			{
				this._editTimeouts.delete(textDocument);

				if (documentPath in this._parsedFiles) delete this._parsedFiles[ documentPath ];
				return;
			}
			this._parseFile(documentUri, textDocument.getText());
		}, timeoutDuration));
	}
	private _registerEvents(): void
	{
		vscode.window.onDidChangeVisibleTextEditors(this._onVisibleEditorChanged, this);
		vscode.window.onDidChangeActiveTextEditor(this._onActiveEditorChanged, this);

		vscode.workspace.onDidChangeTextDocument(this._onDocumentEdited, this);
		// Parse workspace documents on registered
		vscode.workspace.textDocuments.forEach(this._parseEditedDocument, this);
	}
	// #endregion
	// #endregion
}
// #endregion