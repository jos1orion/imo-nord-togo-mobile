const ts = require('typescript');
const fs = require('fs');
const file='src/screens/AdminScreen.tsx';
const text=fs.readFileSync(file,'utf8');
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.JSX, text);
let stack=[];
let token = scanner.scan();
function nextToken(tok){
  // handle template scanning
  if (tok === ts.SyntaxKind.TemplateHead || tok === ts.SyntaxKind.TemplateMiddle) {
    return scanner.reScanTemplateToken();
  }
  return scanner.scan();
}
while(token !== ts.SyntaxKind.EndOfFileToken){
  const pos = scanner.getTokenPos();
  if(token === ts.SyntaxKind.OpenBraceToken){
    stack.push(pos);
  } else if(token === ts.SyntaxKind.CloseBraceToken){
    if(stack.length===0){
      const lc = source.getLineAndCharacterOfPosition(pos);
      console.log('Extra } at', lc.line+1, lc.character+1);
      process.exit(0);
    }
    stack.pop();
  }
  token = nextToken(token);
}
if(stack.length){
  console.log('Unclosed { count', stack.length);
  for(const pos of stack.slice(-5)){
    const lc = source.getLineAndCharacterOfPosition(pos);
    console.log(' -', lc.line+1, lc.character+1);
  }
}
