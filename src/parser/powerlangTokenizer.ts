"use strict";
// #region Imports
import { PowerlangCore, TokenType, BOOLEANS, OPERATORS, LOGIC_GATES } from "./powerlangCore";
import { PowerlangPointer } from "./powerlangPointer";
// #endregion
// #region Types
export type PowerlangToken = {
	content: string;
	type: TokenType;
};
// #endregion
// #region Classes
export class PowerlangTokenizer
{
	// #region Variables
	// #region Public
	public readonly tokens: PowerlangToken[];
	// #endregion
	// #region Private
	private _directiveStart: number;
	private _currentToken: string[];

	private _bracketCount: number;
	private _currentType?: TokenType;
	// #endregion
	// #endregion
	// #region Functions
	// #region Public
	public constructor(private readonly _core: PowerlangCore, parseUntil: string = ";}")
	{
		const pointer: PowerlangPointer = _core.pointer;
		this.tokens = [];

		this._directiveStart = pointer.pointerIndex = 0;
		this._currentToken = [];

		this._bracketCount = 0;

		let previousType: TokenType | undefined;
		while (pointer.pointerIndex < _core.sourceLength)
		{
			const readCharacter: string = pointer.getPointedCharacter();
			if (parseUntil.includes(readCharacter))
			{
				// TODO: Exception handling correctly
				if (this._currentType === TokenType.String)
				{
					console.warn("Unclosed string");
					break;
				}
				if (readCharacter == "\n" && ("MultilineCallsTest" in _core.flags) && this._bracketCount > 0)
				{
					if (this._currentType !== undefined) previousType = this._currentType;

					this._applyCurrentToken();
					pointer.increment();

					continue;
				}

				this._applyCurrentToken();
				pointer.increment();

				break;
			}
		}
		// Source:string, MainPointer:SharedClasses.Pointer, SharedContext:SharedClasses.SharedContext, ExecutableContext:SharedClasses.ExecutableContext, ParseUntil, Core

		/*
		if not ParseUntil then
			ParseUntil = {";", "}"}
		end
		local CurrentlyParsing = ""
		local LastTypeBeforeWhitespace = nil
		local CurrentlyParsingTokenType = nil
		local BracketCount = 0
		local Tokens = {}
		while MainPointer.PointingTo < MainPointer.Maximum do
			local Character = MainPointer:GetPointedCharacter(Source)
			-- Specials
			if table.find(ParseUntil, Character) then
				if CurrentlyParsingTokenType == "String" then
					EWI.Error(5, SharedContext, ExecutableContext, "Unclosed string")
				end
				--hack
				if Character == "\n" and ExecutableContext.Flags:HasFlag("MultilineCallsTest") and BracketCount > 0 then
					LastTypeBeforeWhitespace = CurrentlyParsingTokenType or LastTypeBeforeWhitespace
					ApplyCurrentToken()
					MainPointer:Increment()
					continue
				end
				ApplyCurrentToken()
				MainPointer:Increment()
				break
			end
			if table.find(SyntaxBasics.Indentation, Character) and (not CurrentlyParsingTokenType or table.find({"Number", "Operator", "Variable"}, CurrentlyParsingTokenType)) then
				LastTypeBeforeWhitespace = CurrentlyParsingTokenType or LastTypeBeforeWhitespace
				ApplyCurrentToken()
				MainPointer:Increment()
				continue
			end
			if Character == "," then
				ApplyCurrentToken()
				table.insert(Tokens, NewToken(Character, "Operator"))
				MainPointer:Increment()
				continue
			end
			if find(SyntaxBasics.Operators, Character) then
				local chk = true
				if (Character == ".") and CurrentlyParsingTokenType == "Number" then
					chk = false
				end
				if (Character == "-") and (#Tokens == 0 or CurrentlyParsingTokenType == "Operator" or (not CurrentlyParsingTokenType and LastTypeBeforeWhitespace == "Operator") or (not CurrentlyParsingTokenType and not LastTypeBeforeWhitespace)) then
					chk = false
				end
				if chk then
					if CurrentlyParsingTokenType and CurrentlyParsingTokenType ~= "Operator" then
						table.insert(Tokens, NewToken(CurrentlyParsing, CurrentlyParsingTokenType))
						CurrentlyParsing = ""
						CurrentlyParsingTokenType = nil
					end
					CurrentlyParsing = CurrentlyParsing .. Character
					CurrentlyParsingTokenType = "Operator"
					MainPointer:Increment()
					continue
				end
			end
			if find("()", Character) then
				ApplyCurrentToken()
				if Character == "(" then
					BracketCount += 1
				elseif Character == ")" then
					BracketCount -= 1
				else
					warn("Internal bracket fault")
				end
				table.insert(Tokens, NewToken(Character, "Bracket"))
				MainPointer:Increment()
				continue
			end
			if find("[]", Character) then
				ApplyCurrentToken()
				table.insert(Tokens, NewToken(Character, "Index"))
				MainPointer:Increment()
				continue
			end
			-- Number
			if (not CurrentlyParsingTokenType or CurrentlyParsingTokenType == "Operator") and find("-1234567890", Character) then
				ApplyCurrentToken()
				CurrentlyParsingTokenType = "Number"
				CurrentlyParsing = CurrentlyParsing .. Character
				MainPointer:Increment()
				continue
			end
			if CurrentlyParsingTokenType == "Number" then
				if find("1234567890.", Character) then
					if find(CurrentlyParsing, ".") and Character == "." then
						EWI.Error(1, SharedContext, ExecutableContext, "Double decimal points not allowed")
					else
						CurrentlyParsing = CurrentlyParsing .. Character
						MainPointer:Increment()
						continue
					end
				else
					if string.sub(CurrentlyParsing, 1, 1) ~= "-" then
						EWI.Error(1, SharedContext, ExecutableContext, "Unexpected character in number: " .. Character)
					else
						CurrentlyParsingTokenType = "Variable"
						CurrentlyParsing = CurrentlyParsing .. Character
						MainPointer:Increment()
						continue
					end
				end
			end
			-- String
			if (not CurrentlyParsingTokenType or CurrentlyParsingTokenType == "Operator") and find(SyntaxBasics.StringOpeners, Character) then
				ApplyCurrentToken()
				CurrentlyParsingTokenType = "String"
				MainPointer:Increment()
				while MainPointer.PointingTo < MainPointer.Maximum do
					local Character = MainPointer:GetPointedCharacter(Source)
					if find(SyntaxBasics.StringOpeners, Character) then
						table.insert(Tokens, NewToken(CurrentlyParsing, "String"))
						CurrentlyParsing = ""
						CurrentlyParsingTokenType = nil
						MainPointer:Increment()
						break
					end
					if Character == "\\" then
						MainPointer:Increment()
						Character = MainPointer:GetPointedCharacter(Source)
					end
					CurrentlyParsing = CurrentlyParsing .. Character
					MainPointer:Increment()
					if MainPointer.PointingTo == MainPointer.Maximum then
						EWI.Error(5, SharedContext, ExecutableContext, "Reached end of file before string closed")
						break
					end
				end
				continue
			end
			-- Anonymous functions
			if (not CurrentlyParsingTokenType or CurrentlyParsingTokenType == "Operator") and Character == "{" then
				ApplyCurrentToken()
				CurrentlyParsingTokenType = "AnonymousFunction"
				MainPointer:Increment()
				if not Core then
					EWI.Error(20, SharedContext, ExecutableContext, "Cannot register this anonymous function because the underlying directive or function did not pass Powerlang.Core")
				end
				local CallStack = {ExecutableContext}
				for _, ExtraCalls in pairs(ExecutableContext.InvokedStack) do
					table.insert(CallStack, ExtraCalls)
				end
				local SubExecutableContext = SharedClasses.ExecutableContext("<anonymous>", CallStack, true)
				SubExecutableContext.DefinedVariables = ExecutableContext.DefinedVariables
				SubExecutableContext.Flags = ExecutableContext.Flags
				local FunctionBlocks = Core.powerlang.Parse(Source, SubExecutableContext, MainPointer, "}")
				local FunctionToken = NewToken("AnonymousFunction", "AnonymousFunction")
				FunctionToken.BlocksCreated = FunctionBlocks
				table.insert(Tokens, FunctionToken)
				CurrentlyParsingTokenType = nil
				continue
			end
			-- Variable
			if (not CurrentlyParsingTokenType or CurrentlyParsingTokenType == "Operator" or CurrentlyParsingTokenType == "Variable") and find(SyntaxBasics.AllowedCharsInVariables, string.upper(Character)) then
				if CurrentlyParsingTokenType ~= "Variable" then
					ApplyCurrentToken()
				end
				CurrentlyParsingTokenType = "Variable"
				CurrentlyParsing = CurrentlyParsing .. Character
				MainPointer:Increment()
				continue
			end
			EWI.Error(1, SharedContext, ExecutableContext, "Unexpected character: " .. Character)
		end
		return Tokens
		*/
	}
	// #endregion
	// #region Private
	private _applyCurrentToken(): void
	{
		if (this._currentType === undefined) return;

		const currentParsed: string = this._currentToken.join("");
		this._currentToken = [];

		switch (this._currentType)
		{
			case TokenType.Variable:
				{
					if (LOGIC_GATES.includes(currentParsed)) this._currentType = TokenType.Boolean;
					else if (BOOLEANS.includes(currentParsed)) this._currentType = TokenType.Operator;

					break;
				}
			case TokenType.Number:
				{
					if (currentParsed == "-") this._currentType = TokenType.Operator;
					break;
				}
		}
		this.tokens.push({
			content: currentParsed,
			type: this._currentType
		});
		this._currentType = undefined;
		/*
			local function ApplyCurrentToken()
				if CurrentlyParsingTokenType then
					if CurrentlyParsingTokenType == "Variable" then
						if table.find(SyntaxBasics.LogicGates, CurrentlyParsing) then
							CurrentlyParsingTokenType = "Operator"
						end
						if table.find({"true", "false"}, CurrentlyParsing) then
							CurrentlyParsingTokenType = "Boolean"
						end
					end
					if CurrentlyParsingTokenType == "Number" and CurrentlyParsing == "-" then
						CurrentlyParsingTokenType = "Operator"
					end
					table.insert(Tokens, NewToken(CurrentlyParsing, CurrentlyParsingTokenType))
					CurrentlyParsing = ""
					CurrentlyParsingTokenType = nil
				end
			end
		*/
	}
	// #endregion
	// #endregion
}
// #endregion