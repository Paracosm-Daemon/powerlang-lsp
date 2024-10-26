"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Modules
import { PowerlangProvider } from "./powerlangProvider";
import { PowerlangHandle } from "./powerlangHandle";
// #endregion
// #region Constants
const REGEX_COLOR: RegExp = /\b((Color3.fromRGB\s*\(\s*)((?<red>\d+)\s*,\s*(?<green>\d+)\s*,\s*(?<blue>\d+))\s*\))/g;
const COLOR_RANGE: number = 255.;
// #endregion
// #region Classes
export class PowerlangColorProvider extends PowerlangProvider
{
	// #region Functions
	// #region Overrides
	public constructor(handle: PowerlangHandle)
	{
		super(handle);
		this._registerEvents();
	}
	// #endregion
	// #region Public
	public provideColorPresentations(color: vscode.Color, _context: { readonly document: vscode.TextDocument; readonly range: vscode.Range; }): vscode.ProviderResult<vscode.ColorPresentation[]>
	{
		const green: string = (color.green * COLOR_RANGE).toFixed(0);
		const blue: string = (color.blue * COLOR_RANGE).toFixed(0);
		const red: string = (color.red * COLOR_RANGE).toFixed(0);

		return [ new vscode.ColorPresentation(`Color3.fromRGB(${red}, ${green}, ${blue})`) ];
	}
	public provideDocumentColors(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.ColorInformation[]>
	{
		const documentColors: vscode.ColorInformation[] = [];
		for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++)
		{
			REGEX_COLOR.lastIndex = 0;

			const lineText = document.lineAt(lineIndex).text;
			let colorMatch: RegExpExecArray | null;

			while ((colorMatch = REGEX_COLOR.exec(lineText)) !== null)
			{
				const groups: { [ key: string ]: string; } | undefined = colorMatch.groups;
				if (groups === undefined) break;

				const green: number = Number.parseInt(groups.green);
				const blue: number = Number.parseInt(groups.blue);
				const red: number = Number.parseInt(groups.red);

				documentColors.push(new vscode.ColorInformation(
					new vscode.Range(lineIndex, colorMatch.index, lineIndex, colorMatch.index + colorMatch[ 0 ].length),
					new vscode.Color(red / COLOR_RANGE, green / COLOR_RANGE, blue / COLOR_RANGE, 1.)
				));
			}
		}
		return documentColors;
	}
	// #endregion
	// #region Private
	private _registerEvents(): void
	{
		this.handle.context.subscriptions.push(vscode.languages.registerColorProvider(
			"powerlang",
			this
		));
	}
	// #endregion
	// #endregion
}
// #endregion