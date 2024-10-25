"use strict";
// #region Imports
import * as vscode from "vscode";
import { PowerlangHandle } from "./powerlangHandle";
// #endregion
// #region Constants
export const INTERNAL_NAME = "vscode-powerlang";
const VERSION = require("../package.json").version;
// #endregion
// #region Functions
export function activate(context: vscode.ExtensionContext): void
{
	console.log(`Loading ${INTERNAL_NAME} v${VERSION}`);
	console.time(INTERNAL_NAME);
	// Initialize all providers
	new PowerlangHandle(context);
	// Finish job
	console.timeEnd(INTERNAL_NAME);
	console.log(`${INTERNAL_NAME} initialized`);
}
// #endregion