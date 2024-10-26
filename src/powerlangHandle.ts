"use strict";
// #region Imports
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
// #endregion
// #region Exports
export const FILE_ENCODING: BufferEncoding & fs.WriteFileOptions = "utf-8";

export const LIBRARY_COLORING_RESOURCE_NAME: string = "libraryColoring.json";
export const LIBRARY_RESOURCE_NAME: string = "libraries.json";
export const GLOBALS_RESOURCE_NAME: string = "globals.json";
// #endregion
// #region Modules
import { PowerlangCompletionProvider } from "./completionProvider";
import { PowerlangAPI, PowerlangGlobal } from "./powerlangAPI";
import { PowerlangColorProvider } from "./colorProvider";
import { PowerlangHoverProvider } from "./hoverProvider";
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
	// #region Variables
	// #region Public
	public globalLibraries: PowerlangGlobal[];
	public globalFunctions: PowerlangAPI[];

	public readonly globalsRegenerated: vscode.Event<void>;

	public readonly powerlangScraper: PowerlangScraper;
	public readonly powerlangParser: PowerlangParser;

	public readonly powerlangCompletion: PowerlangCompletionProvider;
	public readonly powerlangHovering: PowerlangHoverProvider;
	public readonly powerlangColoring: PowerlangColorProvider;
	// #endregion
	// #region Private
	private readonly _globalsRegeneratedEmitter: vscode.EventEmitter<void>;
	// #endregion
	// #endregion
	// #region Functions
	// #region Public
	public constructor(public readonly context: vscode.ExtensionContext)
	{
		// Just have to assign these by default because TS gets mad
		this.globalFunctions = [];
		this.globalLibraries = [];

		this._globalsRegeneratedEmitter = new vscode.EventEmitter();
		this.globalsRegenerated = this._globalsRegeneratedEmitter.event;

		this.powerlangScraper = new PowerlangScraper(this);
		this.powerlangParser = new PowerlangParser(this);

		this.powerlangCompletion = new PowerlangCompletionProvider(this);
		this.powerlangHovering = new PowerlangHoverProvider(this);
		this.powerlangColoring = new PowerlangColorProvider(this);

		this._initialize();
	}
	public loadGlobals(globalLibraries: PowerlangGlobal[], globalFunctions: PowerlangAPI[]): void
	{
		this.globalFunctions = globalFunctions;
		this.globalLibraries = globalLibraries;
		// Fire after setting; this will run on initialization too
		this._globalsRegeneratedEmitter.fire();
	}

	public getResourcePath(fileName: string): string { return this.context.extensionPath + path.sep + "resources" + path.sep + fileName; }
	public formatNotification(message: string): string { return `${INTERNAL_NAME}: ${message}`; }

	public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showInformationMessage(this.formatNotification(message), ...items); }
	public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showWarningMessage(this.formatNotification(message), ...items); }
	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> { return vscode.window.showErrorMessage(this.formatNotification(message), ...items); }
	// #endregion
	// #region Private
	private _registerVersion(): void
	{
		const context: vscode.ExtensionContext = this.context;

		const previousVersion: string | undefined = context.globalState.get(VERSION_KEY);
		const currentVersion: string = context.extension.packageJSON.version;

		context.globalState.update(VERSION_KEY, currentVersion);
		// Undefined means that this just got installed, so it shouldn't show as "updated"
		if (previousVersion !== undefined && previousVersion !== currentVersion)
			this.showInformationMessage(`Updated to v${currentVersion}`);
	}
	private _registerEvents(): void
	{
		const librariesFile: number = fs.openSync(this.getResourcePath(LIBRARY_RESOURCE_NAME), "r");
		const globalsFile: number = fs.openSync(this.getResourcePath(GLOBALS_RESOURCE_NAME), "r");

		const librariesJSON: string = fs.readFileSync(librariesFile, { encoding: FILE_ENCODING });
		const globalsJSON: string = fs.readFileSync(globalsFile, { encoding: FILE_ENCODING });

		fs.closeSync(librariesFile);
		fs.closeSync(globalsFile);

		this.loadGlobals(JSON.parse(librariesJSON), JSON.parse(globalsJSON));
	}

	private _initialize(): void
	{
		this._registerVersion();
		this._registerEvents();
	}
	// #endregion
	// #endregion
}
// #endregion