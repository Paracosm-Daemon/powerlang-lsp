"use strict";
/**
	@author paracosm-daemon
	This follows the same rules as the Core lua from the plugin
**/
// TODO: I probably need to redo a lot of this stuff and research the tokenizer more because I have no idea what SharedContext and Context is
// #region Enums
export enum ErrorCodes
{
	UnexpectedCharacter,
	UnknownDirective,
	EndOfFile,
	InvalidVariableDefinition,
	UnclosedString,
	MisplacedOperator,
	InvalidOperation,
	NotYourFault,
	InvalidAssignment,
	NotImplemented,
	InvalidMultiAssignment,
	InvalidFlag,
	UndefinedFunctionSize,
	InvalidArgumentCount,
	CompilerServicesError,
	InvalidReturn,
	UnknownInstanceOperation,
	DirectiveNotValidHere,
	InsufficientArguments,
	InternalImplementation,
	UnknownEvent,
	DeprecatedFeature,
	NestedThread,
}
enum TokenTypes
{
	Flag,
	Keyword,
	Number,
	String,
	Boolean,
	Operator,
	Variable,
	Comment
}
// #endregion
// #region Imports
import * as vscode from "vscode";
// #endregion
// #region Exports
export const REGEX_ASSIGNMENT: RegExp = /([A-Z_]+[A-Z0-9_-]*)\s*=/i;
export const REGEX_CONDITIONALS: RegExp = /^(IF|WHILE)/i;

export const REGEX_VARIABLE: RegExp = /[A-Z_]+[A-Z0-9_-]*/i;
export const REGEX_FLAG: RegExp = /@FLAG\s+/i;

export const REGEX_PATH_BREAK: RegExp = /[^A-Z0-9_.]+/gi;
export const REGEX_BREAK: RegExp = /[\n;]/g;

export const VARIABLE_ALLOWED_CHARACTERS: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_-.1234567890";
export const DIRECTIVE_ALLOWED_CHARACTERS: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ@-";

export const OPERATORS: string = "+-/*^%.:=<>~#";
export const INDENTATION_CHARACTERS: string = "\n\t ";

export const DECLARATION_BREAKS: string = "\n;";
export const DIRECTIVE_BREAKS: string = DECLARATION_BREAKS + " ";

export const FLAG_ANNOTATION: string = "@FLAG";
export const LOGIC_GATES: string[] = [
	"and",
	"not",
	"or"
];
// #endregion
// #region Modules
import { declare, handleDirective } from "./powerlangDirectives";
import { PowerlangPointer } from "./powerlangPointer";
import { PowerlangHandle } from "../powerlangHandle";
import { INTERNAL_NAME } from "../extension";
// #endregion
// #region Constants
const REGEX_DIRECTIVE_BREAK: RegExp = /(;|\n| )+/g; // /[^;\n ]*/g;
const REGEX_CARRIAGE: RegExp = /\r/g;
const REGEX_SEARCH: RegExp = /\S+/;
// #endregion
// #region Classes
export class PowerlangCore
{
	// #region Variables
	// #region Public
	public readonly flags: { [ flag: string ]: boolean; };

	public readonly sourceLength: number;
	public readonly source: string;

	public pointer: PowerlangPointer;
	public invalidScript: boolean;
	// #endregion
	// #endregion
	// #region Functions
	// #region Public
	public constructor(public readonly handle: PowerlangHandle, source: string)
	{
		// Assign private variables
		// Trim whitespace and remove carriage returns since they doesn't play nice
		this.source = source.replace(REGEX_CARRIAGE, "").trim();
		// Assign public variables
		this.pointer = new PowerlangPointer(this.source);
		this.invalidScript = false;

		this.sourceLength = this.source.length;
		this.flags = {
			MultilineCallsTest: true, // MultilineCallsTest true by default
			AllowNoSemicolons: true // AllowNoSemicolons true by default
		};
		// Check if the script is empty, or cannot be tokenized
		if (this.sourceLength === 0) return;
		// Finally, tokenize the source
		this._parse();
	}
	// #endregion
	// #region Private
	private _parse(): void
	{
		const maxTokenizationLength: number | undefined = vscode.workspace.getConfiguration("editor").get<number>("maxTokenizationLineLength");
		const lineCount: number = this.source.split("\n").length;

		if (maxTokenizationLength === undefined || lineCount > maxTokenizationLength) return;
		const pointer: PowerlangPointer = this.pointer;

		let directiveStart: number = pointer.pointerIndex = 0;
		let currentToken: string[] = [];

		// while (pointer.pointerIndex < this.sourceLength)
		// {
		// 	const readCharacter: string = this.source[ pointer.pointerIndex ];
		// 	if (currentToken.length === 0 && INDENTATION_CHARACTERS.includes(readCharacter))
		// 	{
		// 		pointer.increment();
		// 		continue;
		// 	}

		// 	if (DIRECTIVE_BREAKS.includes(readCharacter))
		// 	{
		// 		const parsedDirective: string = currentToken.join("").toUpperCase();
		// 		handleDirective(this, parsedDirective, directiveStart);

		// 		directiveStart = pointer.pointerIndex;
		// 		currentToken = [];

		// 		continue;
		// 	}
		// 	if (!DIRECTIVE_ALLOWED_CHARACTERS.includes(readCharacter.toUpperCase()))
		// 	{
		// 		pointer.pointerIndex = directiveStart;
		// 		declare(this);

		// 		directiveStart = pointer.pointerIndex;
		// 		currentToken = [];

		// 		continue;
		// 	}
		// 	/*
		// 	-- If not, then is the directive so far valid?
		// 	if not string.find(SyntaxBasics.AllowedCharsInDirectives, string.upper(Character), nil, true) then
		// 		--EWI.Error(1, SharedContext, Context, "Unexpected character '" .. Character .. "' while parsing directive")
		// 		--return
		// 		MainPointer.PointingTo = DirectiveBeginning
		// 		local BlocksCreatedByDirective:{VisualLibrary.AbstractBlock}, DoNotAttach = Directives.DECLARE(Source, MainPointer, SharedContext, Context, getfenv(debug.info(1, "f")))
		// 		if #BlocksCreatedByDirective ~= 0 then
		// 			if not DoNotAttach then
		// 				RootBlock:ConnectToBlock(BlocksCreatedByDirective[1])
		// 			end
		// 			table.move(BlocksCreatedByDirective, 1, #BlocksCreatedByDirective, #BlocksCreatedHere + 1, BlocksCreatedHere)
		// 		end
		// 		CurrentlyParsed = ""
		// 		DirectiveBeginning = MainPointer.PointingTo
		// 		continue
		// 	end
		// 	*/

		// 	currentToken.push(readCharacter);
		// 	pointer.increment();
		// }
	}
	// #endregion
	// #endregion
}
// #endregion