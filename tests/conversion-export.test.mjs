import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractedConversionMarkdown,conversionCopyName} from '../src/lib/markdown/conversionExport.ts';
const envelope=value=>JSON.stringify({data:{success:true,source:'file',cleaned_text:value},metadata:{function:'convert_to_markdown'}});
test('only an explicit converter envelope is decoded, preserving the extracted bytes and escapes',()=>{
 const source='\uFEFF# Title\r\n\r\nCode: `\\n` and \\(x^2\\).\r\n';
 assert.equal(extractedConversionMarkdown(envelope(source)),source);
 assert.equal(extractedConversionMarkdown('\uFEFF'+envelope(source)),source);
 for(const text of ['# Ordinary Markdown\n', '{broken JSON',JSON.stringify({data:{cleaned_text:'not a converter'}}),JSON.stringify({data:{success:false,source:'file',cleaned_text:'# Not successful'},metadata:{function:'convert_to_markdown'}}),envelope('')])assert.equal(extractedConversionMarkdown(text),null);
});
test('extraction chooses a separate Markdown destination and handles existing copies',()=>{
 assert.equal(conversionCopyName('Book.md'),'Book (Markdown).md');
 assert.equal(conversionCopyName('Book.markdown',['Book (Markdown).md','Book (Markdown) (1).md']),'Book (Markdown) (2).md');
});
