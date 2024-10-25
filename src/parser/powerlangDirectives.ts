"use strict";
// #region Imports
import { PowerlangTokenizer, PowerlangToken } from "./powerlangTokenizer";
import { PowerlangCore, VALID_FLAGS } from "./powerlangCore";
import { PowerlangPointer } from "./powerlangPointer";
// #endregion
// #region Constants
const REGEX_FLAG: RegExp = /(?! )[^;\n]*/;

const ALLOWED_BREAK_CHARACTERS: string = ";{";
const ALLOWED_BREAK_CHARACTERS_FULL: string = ALLOWED_BREAK_CHARACTERS + "\n";
// #endregion
// #region Functions
export function declare(core: PowerlangCore, eventOverride: boolean = false): string[]
{
	/*
	function DECLARE(
		Source:string,
		MainPointer:SharedClasses.Pointer,
		SharedContext:SharedClasses.SharedContext,
		ExecutableContext:SharedClasses.ExecutableContext,
		CalledFromAnotherDirective:any?,
		IgnoreAssignment:boolean?,
		AllowAnonymousFunctions:boolean?,
		EventOverride:boolean?
	)
	*/
	const pointer: PowerlangPointer = core.pointer;
	// For compatibility
	let breakCharacters: string = (VALID_FLAGS[ 3 ] in core.flags) ? ALLOWED_BREAK_CHARACTERS_FULL : ALLOWED_BREAK_CHARACTERS;
	if (eventOverride) breakCharacters += "()";

	const tokenizer: PowerlangTokenizer = new PowerlangTokenizer(core.source, pointer, breakCharacters);
	return [];
	/*
	-- Let the core do its thing
	local Core = nil
	local IsFirstBlockSeparate = false --if true, this declare will not be connected to root
	-- hack
	if typeof(CalledFromAnotherDirective) == "table" then
		AllowAnonymousFunctions = true
		Core = CalledFromAnotherDirective
	end
	local AllowedBreakChars = {";", "{"}
	if ExecutableContext.Flags:HasFlag("AllowNoSemicolons") then
		AllowedBreakChars = {";", "{", "\n"}
	end
	if EventOverride then
		table.insert(AllowedBreakChars, "(")
		table.insert(AllowedBreakChars, ")")
	end
	if AllowAnonymousFunctions then
		table.remove(AllowedBreakChars, 2)
	end
	local Tokens = core.Parse(Source, MainPointer, SharedContext, ExecutableContext, AllowedBreakChars, Core)
	local BlocksCreatedHere:{VisualLibrary.AbstractBlock} = {}
	-- convert negative variables
	for i, Token in pairs(Tokens) do
		if Token.Type == "Variable" and string.sub(Token.Content, 1, 1) == "-" then
			local OutputTo = GenerateUniqueName("Operator-")
			local NegateBlock = VisualLibrary.NewBlock("Subtraction", "Operator-", {
				VisualLibrary.NewInput("Number1", 0),
				VisualLibrary.NewInput("Number2", string.sub(Token.Content, 2), true),
				VisualLibrary.NewOutput("Result", OutputTo)
			})
			table.insert(BlocksCreatedHere, NegateBlock)
			Token.Content = OutputTo
		end
	end

	-- Process bracket pairs
	local _TempStack = {}
	local BracketPairs = {}
	for i, Token in pairs(Tokens) do
		if Token.Type ~= "Bracket" then
			continue
		end
		if Token.Content == "(" then
			table.insert(_TempStack, i)
		elseif Token.Content == ")" then
			local StartToken = _TempStack[#_TempStack]
			if not StartToken then
				EWI.Error(1, SharedContext, ExecutableContext, "Unexpected closing bracket")
				continue
			end
			table.insert(BracketPairs, {StartToken, i})
			table.remove(_TempStack, #_TempStack)
		end
	end
	if #_TempStack > 0 then
		EWI.Error(1, SharedContext, ExecutableContext, "Unclosed bracket")
	end
	table.insert(BracketPairs, {0, #Tokens + 1})
	-- Now we process the bracket pairs!
	local BracketTupleData = {
		Example = {"token1here", "token2here"}
	}
	local leftshift = 0
	for _, BracketPair in pairs(BracketPairs) do
		local IsTuple = false
		local TupleTokenItems = {}
		local LastComma = 1
		local OwnTokensUnfiltered = {}
		table.move(Tokens, BracketPair[1] + 1, BracketPair[2] - 1, 1, OwnTokensUnfiltered)
		local OwnTokens = {}
		local LocalShift = 0
		for _, tkn in pairs(OwnTokensUnfiltered) do
			if tkn ~= 0 then
				table.insert(OwnTokens, tkn)
			else
				LocalShift += 1
			end
		end
		local FormerlyTokens = #Tokens
		local TokensOnceInBracket = #OwnTokensUnfiltered
		local FutureBracketTokenName = GenerateUniqueName("Bracket-")
		-- Let's process indexes
		local _TempStack = {}
		local TableIndexPairs = {}
		for i, Token in pairs(OwnTokens) do
			if Token.Type ~= "Index" then
				continue
			end
			if Token.Content == "[" then
				table.insert(_TempStack, i)
			elseif Token.Content == "]" then
				local StartToken = _TempStack[#_TempStack]
				if not StartToken then
					EWI.Error(1, SharedContext, ExecutableContext, "Unexpected closing table index")
					continue
				end
				table.insert(TableIndexPairs, {StartToken, i})
				table.remove(_TempStack, #_TempStack)
			end
		end
		if #_TempStack > 0 then
			EWI.Error(1, SharedContext, ExecutableContext, "Unclosed index")
		end
		table.insert(TableIndexPairs, {0, #OwnTokens + 1})
		-- i LOVE loops in loops!!
		for _, IndexPair in pairs(TableIndexPairs) do
			local isRealTableIndex = true
			if IndexPair[1] == 0 then
				isRealTableIndex = false
			end
			local FutureTokenName = GenerateUniqueName("TableIndex-") -- needed to save result
			local IndexTokens = {}
			local IndexTokensUnfiltered = {}

			table.move(OwnTokens, IndexPair[1] + 1, IndexPair[2] - 1, 1, IndexTokensUnfiltered)
			for _, tkn in pairs(IndexTokensUnfiltered) do
				if tkn and tkn ~= 0 then
					table.insert(IndexTokens, tkn)
				end
			end
			local TokensWeHad = #IndexTokensUnfiltered
			-- Preprocess dot indexes to avoid issues with function calls for Instances/Tables
			local i = 1
			while i <= #IndexTokens do
				local Token = IndexTokens[i]
				if not Token then
					i+=1
					continue
				end
				if Token.Type == "Operator" and (Token.Content == "." or Token.Content == ":") then
					local TokenPrev = IndexTokens[i-1]
					local TokenNext = IndexTokens[i+1]
					if not TokenPrev or not TokenNext then
						EWI.Error(6, SharedContext, ExecutableContext, ". not permitted here")
					end
					if not table.find({"Variable", "BracketResultTuple"}, TokenPrev.Type) or TokenNext.Type ~= "Variable" then
						i+=1
						continue
						--EWI.Error(7, SharedContext, ExecutableContext, "Cannot index " .. TokenPrev.Type .. " with " .. TokenNext.Type)
					end
					if TokenPrev.Type == "BracketResultTuple" then
						i+=1
						continue
					end
					if TokenPrev.AssociatedWithFunction then
						i+=1
						continue
					end
					local NewToken = {Type="Variable", Content=`{TokenPrev.Content}{Token.Content}{TokenNext.Content}`}
					for _ = 1,3 do
						table.remove(IndexTokens, i-1)
					end
					table.insert(IndexTokens, i-1, NewToken)
					local NextToken = IndexTokens[i]
					if NextToken and NextToken.IsBracket then
						NextToken.AssociatedWithFunction = true
					end
					i-=3
				end
				i+=1
			end
			-- Now process function calls and indexes from left to right
			-- Types of brackets: BracketResult, TableIndex
			local i = 1
			local LastToken = nil
			while i <= #IndexTokens do
				local Token = IndexTokens[i]
				local MaybeLastToken = IndexTokens[i-1]
				if MaybeLastToken then
					LastToken = MaybeLastToken
				end
				if not Token or Token == 0 then
					i+=1
					continue
				end
				if table.find({"BracketResultTuple", "FunctionTuple", "BracketResult", "TableIndex", "Variable"}, Token.Type) or Token.IsBracket then
					if Token.Type == "Variable" and not Token.IsBracket then
						i+=1
						LastToken = Token
						continue
					end
					if not LastToken or not table.find({"Variable", "TableIndex"}, LastToken.Type) then
						i+=1
						LastToken = Token
						continue
					end
					local CallOutputName = GenerateUniqueName("CallIndexOutput-")
					if Token.Type == "TableIndex" then
						local TokenAfter = IndexTokens[i+1]
						--print(`Table index: {LastToken.Content}[{Token.Content}] -> {CallOutputName}`)
						local NextTokenContent = Token.Content
						if Token.OriginalType == "Number" then
							NextTokenContent = tonumber(NextTokenContent)
						elseif Token.OriginalType == "Boolean" then
							NextTokenContent = NextTokenContent == "true"
						elseif Token.OriginalType == "Variable" and string.find(Token.Content, ".", nil, true) then
							NextTokenContent = GetPathToBlocks(Token.Content, BlocksCreatedHere)
						end
						if not (TokenAfter and TokenAfter.Type == "Operator" and TokenAfter.Content == "=") then
							local IndexBlock = VisualLibrary.NewBlock("GetTableValue", GenerateUniqueName("Traversal-"), {
								VisualLibrary.NewInput("Table", LastToken.Content),
								VisualLibrary.NewInput("Key", NextTokenContent, Token.OriginalType == "Variable"),
								VisualLibrary.NewOutput("Value", CallOutputName)
							})
							if #BlocksCreatedHere > 0 then
								BlocksCreatedHere[#BlocksCreatedHere]:ConnectToBlock(IndexBlock)
							end
							table.insert(BlocksCreatedHere, IndexBlock)
						end
						for _ = 1,2 do
							table.remove(IndexTokens, i-1)
						end
						table.insert(IndexTokens, i-1, {Type="Variable", Content=CallOutputName, OriginalTableToken=LastToken, OriginalKey=NextTokenContent, IsKeyVariable=(Token.OriginalType == "Variable")})
						i-=1
					else
						-- oh lord

						-- WIP WIP WIP WIP WIP WIP TODO TODO TODO!!!!!!!!!
						local FunctionBeingCalled = LastToken.Content
						local IsInstanceFunction = (string.find(LastToken.Content, ":", nil, true) ~= nil)
						local FunctionParent = nil
						local Arguments = Token.Content
						local OutputVariable = GenerateUniqueName("FunctionOutput-")
						if not DefaultAbstractFunctions[LastToken.Content] then
							if (string.find(FunctionBeingCalled, ".", nil, true) or string.find(FunctionBeingCalled, ":", nil, true)) and IsInstanceFunction then
								local LastStep, InstanceCall = GetPathToBlocks(FunctionBeingCalled, BlocksCreatedHere, true)
								FunctionBeingCalled = InstanceCall
								FunctionParent = LastStep
							end
							if (string.find(FunctionBeingCalled, ".", nil, true) or string.find(FunctionBeingCalled, ":", nil, true)) and not IsInstanceFunction then
								local LastStep = GetPathToBlocks(FunctionBeingCalled, BlocksCreatedHere)
								FunctionBeingCalled = LastStep
							end
						end
						--print(`Call: {FunctionParent}:{FunctionBeingCalled}({Arguments}) -> {OutputVariable}`)
						-- calling a function isn't the hardest part,
						-- collecting its result is 😡😡😡

						local TupleArguments = {}
						if string.find(Token.Type, "Tuple") then
							for _, Tokon in pairs(Token.Content) do
								local ThisItemContent = Tokon.Content
								if Tokon.Type == "Number" then
									ThisItemContent = tonumber(Tokon.Content)
								elseif Tokon.Type == "Boolean" then
									ThisItemContent = Tokon.Content == "true"
								elseif Tokon.Type == "Variable" and string.find(Tokon.Content, ".", nil, true) then
									ThisItemContent = GetPathToBlocks(Tokon.Content, BlocksCreatedHere)
								elseif string.find(Tokon.Type, "Tuple") then
									EWI.Error(10, SharedContext, ExecutableContext, "Passing tuples as function arguments is not yet possible in this version of Powerlang")
								elseif Tokon.Type == "AnonymousFunction" then
									EWI.Error(10, SharedContext, ExecutableContext, "Passing an anonymous function as an argument here is not yet supported in this version of Powerlang")
								end

								table.insert(TupleArguments, VisualLibrary.NewInput("", ThisItemContent, Tokon.Type == "Variable"))
							end
						else
							local ThisItemContent = Token.Content
							if Token.Type == "Number" then
								ThisItemContent = tonumber(Token.Content)
							elseif Token.Type == "Boolean" then
								ThisItemContent = Token.Content == "true"
							elseif Token.Type == "Variable" and string.find(Token.Content, ".", nil, true) then
								ThisItemContent = GetPathToBlocks(Token.Content, BlocksCreatedHere)
							elseif Token.Type == "AnonymousFunction" then
								EWI.Error(10, SharedContext, ExecutableContext, "Passing an anonymous function as an argument here is not yet supported in this version of Powerlang")
							end
							table.insert(TupleArguments, VisualLibrary.NewInput("", ThisItemContent, Token.Type == "Variable"))
						end

						if not IsInstanceFunction then

							local OutputSize = ExecutableContext.DefinedVariables[LastToken.Content] or DefaultAbstractOutputSizes[LastToken.Content]
							if not OutputSize then
								OutputSize = 1
								EWI.Warn(13, SharedContext, ExecutableContext, `Function '{LastToken.Content}' return size unknown, only the first returned value will be considered.`)
							end
							local SuboutputVariableNames = {}
							if OutputSize > 1 then
								for _=1,OutputSize do
									table.insert(SuboutputVariableNames, VisualLibrary.NewOutput("", GenerateUniqueName("FunctionTupleOutput-")))
								end
							else
								table.insert(SuboutputVariableNames, VisualLibrary.NewOutput("", OutputVariable))
							end
							if DefaultAbstractFunctions[LastToken.Content] then
								--print("Found abstract function handler for " .. LastToken.Content)
								local BlocksCreatedDown, DoNotConnect = DefaultAbstractFunctions[LastToken.Content](FunctionBeingCalled, TupleArguments, SuboutputVariableNames, ExecutableContext, SharedContext, LastToken.Content)
								if #BlocksCreatedHere ~= 0 and #BlocksCreatedDown > 0 and not DoNotConnect then
									BlocksCreatedHere[#BlocksCreatedHere]:ConnectToBlock(BlocksCreatedDown[1])
								end
								if DoNotConnect and #BlocksCreatedHere == 0 then
									IsFirstBlockSeparate = true
								end
								table.move(BlocksCreatedDown, 1, #BlocksCreatedDown, #BlocksCreatedHere + 1, BlocksCreatedHere)
							else
								local CallFunctionBlock = VisualLibrary.NewBlock("ExecuteFunction", GenerateUniqueName("FunctionCall-"), {
									VisualLibrary.NewInput("Function", FunctionBeingCalled),
									VisualLibrary.NewTuple("Parameters", TupleArguments, false),
									VisualLibrary.NewTuple("ReturnedValues", SuboutputVariableNames, true),
								})
								if #BlocksCreatedHere ~= 0 then
									BlocksCreatedHere[#BlocksCreatedHere]:ConnectToBlock(CallFunctionBlock)
								end
								table.insert(BlocksCreatedHere, CallFunctionBlock)
							end
							for _ = 1,2 do
								table.remove(IndexTokens, i-1)
							end

							if #SuboutputVariableNames == 1 then
								table.insert(IndexTokens, i-1, {Type="Variable", Content=OutputVariable})
							elseif #SuboutputVariableNames > 1 then
								local SuboutputTokens = {}
								for _, Suboutput in pairs(SuboutputVariableNames) do
									table.insert(SuboutputTokens, {Type="Variable", Content=Suboutput.OutputVariable})
								end
								table.insert(IndexTokens, i-1, {Type="FunctionTuple", Content=SuboutputTokens})
							end

						else
							if InstanceFunctions[FunctionBeingCalled] then
								local SuboutputVariableNames = {VisualLibrary.NewOutput("", OutputVariable)}
								local BlocksCreatedDown = InstanceFunctions[FunctionBeingCalled](FunctionParent, TupleArguments, SuboutputVariableNames, ExecutableContext, SharedContext, FunctionBeingCalled)
								if #BlocksCreatedHere ~= 0 and #BlocksCreatedDown > 0 then
									BlocksCreatedHere[#BlocksCreatedHere]:ConnectToBlock(BlocksCreatedDown[1])
								end
								table.move(BlocksCreatedDown, 1, #BlocksCreatedDown, #BlocksCreatedHere + 1, BlocksCreatedHere)
								for _ = 1,2 do
									table.remove(IndexTokens, i-1)
								end

								if #SuboutputVariableNames == 1 then
									table.insert(IndexTokens, i-1, {Type="Variable", Content=OutputVariable})
								elseif #SuboutputVariableNames > 1 then
									local SuboutputTokens = {}
									for _, Suboutput in pairs(SuboutputVariableNames) do
										table.insert(SuboutputTokens, {Type="Variable", Content=Suboutput.OutputVariable})
									end
									table.insert(IndexTokens, i-1, {Type="FunctionTuple", Content=SuboutputTokens})
								end
							else
								EWI.Error(17, SharedContext, ExecutableContext, `The instance operation {FunctionBeingCalled} is unknown`)
							end
						end
					end
					-- TODO: the tokens are replaced with result variable or tuple
					-- if there is a dot or : in front, evaluate it as well
				end
				i+=1
				LastToken = Token
			end

			for _, OperatorSet in pairs(SyntaxBasics.OrderOfOperations) do
				local i = 1
				while i <= #IndexTokens do
					local Token = IndexTokens[i]
					if not Token then
						i+=1
						continue
					end
					if Token.Type == "Operator" and table.find(OperatorSet, Token.Content) then
						if Token.Content == "=" and BracketPair[1] ~= 0 then
							EWI.Error(9, SharedContext, ExecutableContext, "Cannot use = character in brackets or indexes")
							return
						end
						if Token.Content ~= "," then
							local Ignore = false
							if Token.Content == "=" and IgnoreAssignment then
								Ignore = true
							end
							if not Ignore then
								local BlocksCreatedByOperator = Operators[Token.Content](IndexTokens, i, GenerateUniqueName("EquationPiece-"), SharedContext, ExecutableContext)
								if IndexTokens[1].Type == "AssignmentResult" then
									IndexTokens = {IndexTokens[1]}
									OwnTokens = {IndexTokens[1]}
								end
								if #BlocksCreatedHere > 0 then
									BlocksCreatedHere[#BlocksCreatedHere]:ConnectToBlock(BlocksCreatedByOperator[1])
								end
								table.move(BlocksCreatedByOperator, 1, #BlocksCreatedByOperator, #BlocksCreatedHere + 1, BlocksCreatedHere)
							end
							if Token.Content == "not" or Token.Content == "=" then
								i+=1
							end
						else
							if IndexPair[1] ~= 0 then
								EWI.Error(1, SharedContext, ExecutableContext, "The , character was not expected here")
								return
							end
							IsTuple = true
							--local TokensForThisPart = {}
							--table.move(OwnTokens, LastComma, i, 1, TokensForThisPart)
							--table.insert(TupleTokenItems, TokensForThisPart)
							--LastComma = i
							i+=1
						end
						continue
					end
					i+=1
				end
			end
			-- This goes at the very end, to save the contents
			if IndexPair[1] == 0 then
				for _=1,TokensWeHad do
					table.remove(OwnTokens, IndexPair[1] + 1)
				end
			else
				for _=1,TokensWeHad+2 do
					table.remove(OwnTokens, IndexPair[1])
				end
			end
			if IsTuple and #IndexTokens > 1 and IndexPair[1] ~= 0 then
				EWI.Error(4, SharedContext, ExecutableContext, "Cannot define tuples in table indexes")
			end
			if (#IndexTokens ~= 1 and not IsTuple) and BracketPair[1] ~= BracketPair[2] - 1 then
				EWI.Error(7, SharedContext, ExecutableContext, "Invalid equation")
			end
			if not IsTuple and IndexPair[1] ~= 0 then
				IndexTokens[1].OriginalType = IndexTokens[1].Type
				IndexTokens[1].Type = "TableIndex"
			end

			if IndexPair[1] == 0 then
				for iii = 1, #IndexTokens do
					table.insert(OwnTokens, math.max(1, IndexPair[1] + 1) + iii - 1, IndexTokens[iii])
				end
			else

				for iii = 1, #IndexTokens do
					table.insert(OwnTokens, math.max(0, IndexPair[1]) + iii - 1, IndexTokens[iii])
				end
			end

			if IndexPair[1] ~= 0 then
				local diff = TokensWeHad+2 - #IndexTokens
				if diff > 0 then
					for _ = 1, diff do
						table.insert(OwnTokens, math.max(0, IndexPair[1]) + 1, 0)
					end
				end
			end
		end
		for _=1,TokensOnceInBracket+2 do
			table.remove(Tokens, math.max(1, BracketPair[1]))
			leftshift += 1
		end
		if (#OwnTokens ~= 1 and not IsTuple) and BracketPair[1] ~= BracketPair[2] - 1 then
			EWI.Error(7, SharedContext, ExecutableContext, "Invalid equation")
		end
		if BracketPair[1] ~= 0 and #OwnTokens ~= 0 then
			if IsTuple then
				BracketTupleData[OwnTokens[1].Content] = OwnTokens
				local TupleResult = {}
				for _, Token in pairs(OwnTokens) do
					if Token.Content == "," and Token.Type == "Operator" then
						continue
					end
					table.insert(TupleResult, {Content=Token.Content, Type=Token.Type, IsBracket=Token.IsBracket, AssociatedWithFunction=Token.AssociatedWithFunction})
				end
				OwnTokens[1].Content = TupleResult
				OwnTokens[1].Type = "BracketResultTuple"
			else
				OwnTokens[1].IsBracket = true
			end
		end
		if BracketPair[1] == BracketPair[2] - 1 then
			table.insert(Tokens, math.max(1, BracketPair[1]), {Content={}, Type="BracketResultTuple", IsBracket=true})
		else
			if not IsTuple then
				for iii = 1, #OwnTokens do
					table.insert(Tokens, math.max(1, BracketPair[1]) + iii - 1, OwnTokens[iii])
				end
			else
				if BracketPair[1] ~= 0 then
					table.insert(Tokens, math.max(1, BracketPair[1]), OwnTokens[1])
				else
					table.move(OwnTokens, 1, #OwnTokens, #Tokens + 1, Tokens)
				end
			end
			for _=1,TokensOnceInBracket+1 do
				table.insert(Tokens, math.max(1, BracketPair[1]) + 1, 0)
			end
		end
		if FormerlyTokens - #Tokens > 0 and BracketPair[1] ~= 0 then
			for _ = 1, FormerlyTokens - #Tokens do
				table.insert(Tokens, BracketPair[1], 0)
			end
		end
		leftshift -= 1
	end
	local TokensFiltered = {}
	for _, tokn in pairs(Tokens) do
		if tokn ~= 0 then
			table.insert(TokensFiltered, tokn)
		end
	end
	if CalledFromAnotherDirective == true then
		return TokensFiltered, BlocksCreatedHere
	end
	return BlocksCreatedHere, IsFirstBlockSeparate
	*/
}
export function handleDirective(core: PowerlangCore, directive: string, directiveStart: number): void
{
	const pointer: PowerlangPointer = core.pointer;
	switch (directive)
	{
		case "@FLAG":
			{
				// Smart regex to replicate the filtering and concatenation the original module does
				// Not global so no need to reset lastIndex
				const flagFull: RegExpExecArray | null = REGEX_FLAG.exec(pointer.source.slice(pointer.pointerIndex));
				if (flagFull === null)
				{
					console.warn(`Invalid flag at index ${pointer.pointerIndex}`);
					pointer.increment();

					break;
				}

				const flagOffset: number = flagFull.index;
				const flagName: string = flagFull[ 0 ];

				console.log(flagName, flagOffset);
				if (!VALID_FLAGS.includes(flagName))
				{
					console.warn(`Flag ${flagName} is an unknown flag`);
					break;
				}

				switch (flagName)
				{
					case VALID_FLAGS[ 3 ]:
						{
							console.warn("The AllowNoSemicolons flag is declared by default starting from Powerlang 0.7. You do not need to declare it anymore.");
							break;
						}
				}
				if (flagName in core.flags)
				{
					// TODO: Add a warning for this
					console.log(`Flag ${flagName} already set, not setting again`);
					break;
				}

				console.warn(`Declaring flag "${flagName}"`);
				core.flags[ flagName ] = true;

				pointer.increment(flagOffset + flagName.length);
				/*
				local FlagToBeDeclared = ""
				while MainPointer.PointingTo < MainPointer.Maximum do
					local Character = MainPointer:GetPointedCharacter(Source)
					if Character == " " and #FlagToBeDeclared == 0 then
						MainPointer:Increment()
						continue
					end
					if Character == ";" or Character == "\n" then
						--print("Declaring flag " .. FlagToBeDeclared)
						if FlagToBeDeclared == "AllowNoSemicolons" then
							EWI.Warn(22, SharedContext, ExecutableContext, "The AllowNoSemicolons flag is declared by default starting from Powerlang 0.7. You do not need to declare it anymore.")
						end
						if not table.find(SyntaxBasics.FlagsAvailable, FlagToBeDeclared) then
							EWI.Error(12, SharedContext, ExecutableContext, "Unknown flag " .. FlagToBeDeclared)
						end
						ExecutableContext.Flags:SetFlag(FlagToBeDeclared)
						break
					end
					FlagToBeDeclared = FlagToBeDeclared .. Character
					MainPointer:Increment()
				end
				MainPointer:Increment()
				*/
			}
	}

	//pointer.pointerIndex = directiveStart;
	declare(core);
	pointer.increment();
}
// #endregion