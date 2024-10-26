"use strict";
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Exports
export const INTERNAL_NAME = "vscode-powerlang";
// #endregion
// #region Modules
import { PowerlangHandle } from "./powerlangHandle";
// #endregion
// #region Functions
export function activate(context: vscode.ExtensionContext): void
{
	console.log(`Loading ${INTERNAL_NAME} v${context.extension.packageJSON.version}`);
	console.time(INTERNAL_NAME);
	// Initialize all providers
	new PowerlangHandle(context);
	// Finish job
	console.timeEnd(INTERNAL_NAME);
	console.log(`${INTERNAL_NAME} initialized`);
}
// #endregion