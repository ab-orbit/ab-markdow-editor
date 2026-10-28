import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceGeometry} from '../src/lib/workspaceGeometry.ts';

const layout=(changes={})=>({nativeChrome:true,width:900,height:650,verticalBarEdge:'right',posture:'fullyOpen',occlusions:[],keyboardVisible:false,textScale:1,...changes});
test('available space expands the library without identifying a device or guessing a fold',()=>{
  assert.equal(workspaceGeometry(layout()).arrangement,'column');
  assert.equal(workspaceGeometry(layout({width:430})).arrangement,'overlay');
  assert.equal(workspaceGeometry(layout({nativeChrome:false})).arrangement,'overlay');
  assert.equal(workspaceGeometry(layout({width:800,textScale:2})).arrangement,'overlay');
  assert.deepEqual(workspaceGeometry(layout({posture:'partiallyOpen'})).focus,{x:0,y:0,width:900,height:650});
});
test('an actual vertical reserved division aligns two usable panes and preserves line regions',()=>{
  for(const gap of [0,24]){
    const result=workspaceGeometry(layout({division:{x:438,y:0,width:gap,height:650}}));
    assert.equal(result.arrangement,'column');assert.equal(result.primary,438);
    assert.ok(result.primary+result.gap<=result.focus.x || result.focus.x===0);
    assert.ok(result.focus.x+result.focus.width<=900);
  }
});
test('horizontal fold places reading above the fold and the library below',()=>{
  const result=workspaceGeometry(layout({width:650,height:900,division:{x:0,y:430,width:650,height:32}}));
  assert.equal(result.arrangement,'stack');assert.equal(result.primary,430);assert.equal(result.gap,32);
  assert.deepEqual(result.focus,{x:0,y:0,width:650,height:430});
});
test('a keyboard or narrow usable region never squeezes a second pane across a fold',()=>{
  const result=workspaceGeometry(layout({height:500,keyboardVisible:true,division:{x:0,y:330,width:900,height:30}}));
  assert.equal(result.arrangement,'overlay');assert.equal(result.focus.height,330);
  const narrow=workspaceGeometry(layout({width:500,division:{x:120,y:0,width:20,height:650}}));
  assert.equal(narrow.arrangement,'overlay');assert.equal(narrow.focus.x,140);assert.equal(narrow.focus.width,360);
});
test('active edge camera regions reserve content space and compose with a fold',()=>{
  const result=workspaceGeometry(layout({occlusions:[{x:850,y:0,width:50,height:60}],division:{x:438,y:0,width:24,height:650}}));
  assert.ok(result.insets.top>=60 || result.insets.right>=50);
  assert.ok(result.focus.x+result.focus.width<=900-result.insets.right);
  assert.ok(result.focus.y>=result.insets.top);
  assert.deepEqual(workspaceGeometry(layout({occlusions:[]})).insets,{top:0,right:0,bottom:0,left:0});
  const folded=workspaceGeometry(layout({occlusions:[{x:438,y:0,width:24,height:650}],division:{x:438,y:0,width:24,height:650}}));
  assert.equal(folded.arrangement,'column');assert.equal(folded.focus.height,650);
});
