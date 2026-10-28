import type { NativeWorkspaceLayout, WorkspaceRect } from './ios';

export interface WorkspaceGeometry {
  /** A library is adjacent only when both panes retain a usable width. */
  arrangement: 'overlay' | 'column' | 'stack';
  primary: number;
  gap: number;
  /** A focused note occupies one usable region instead of straddling an active fold. */
  focus: WorkspaceRect;
  insets: {top: number; right: number; bottom: number; left: number};
}

/** Use an actual system division; an aspect ratio alone never implies a fold. */
export function workspaceGeometry(layout: NativeWorkspaceLayout): WorkspaceGeometry {
  const outerWidth = Math.max(0, layout.width), outerHeight = Math.max(0, layout.height);
  let bounds: WorkspaceRect = {x:0,y:0,width:outerWidth,height:outerHeight};
  // System camera/Island regions can change independently of folding. Prefer the
  // smallest edge inset that excludes an active region, retaining the most content.
  for (const region of layout.occlusions) {
    if (![region.x,region.y,region.width,region.height].every(Number.isFinite) || region.width<=0 || region.height<=0) continue;
    const right=bounds.x+bounds.width,bottom=bounds.y+bounds.height;
    if (region.x>=right || region.y>=bottom || region.x+region.width<=bounds.x || region.y+region.height<=bounds.y) continue;
    const candidates: WorkspaceRect[]=[];
    if (region.y<=bounds.y+1) candidates.push({...bounds,y:Math.min(bottom,region.y+region.height),height:Math.max(0,bottom-region.y-region.height)});
    if (region.x<=bounds.x+1) candidates.push({...bounds,x:Math.min(right,region.x+region.width),width:Math.max(0,right-region.x-region.width)});
    if (region.y+region.height>=bottom-1) candidates.push({...bounds,height:Math.max(0,region.y-bounds.y)});
    if (region.x+region.width>=right-1) candidates.push({...bounds,width:Math.max(0,region.x-bounds.x)});
    // A central folding strip may touch two opposite edges. It is handled by the
    // division below and must never become a zero-height/zero-width camera inset.
    const usable=candidates.filter(rect=>rect.width>=Math.min(120,outerWidth) && rect.height>=Math.min(120,outerHeight));
    if (usable.length) bounds=usable.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  }
  const {width,height}=bounds;
  const scale = Math.max(1, layout.textScale || 1);
  const result: WorkspaceGeometry = {arrangement: 'overlay', primary: 0, gap: 0, focus: bounds, insets:{top:bounds.y,left:bounds.x,right:outerWidth-bounds.x-width,bottom:outerHeight-bounds.y-height}};
  const fold = layout.division;
  if (fold && fold.width >= 0 && fold.height >= 0) {
    const x = Math.max(0, Math.min(width, fold.x-bounds.x)), y = Math.max(0, Math.min(height, fold.y-bounds.y));
    if (fold.height >= height * .6 && fold.width < width * .45) {
      const end = Math.min(width, x + Math.max(fold.width, 12));
      const after = Math.max(0, width - end);
      result.focus = after >= x ? {x: bounds.x+end, y: bounds.y, width: after, height} : {...bounds,width:x};
      if (x >= 220 * scale && after >= 280 * scale) return {...result, arrangement: 'column', primary: x, gap: end - x, focus:{x:bounds.x+end,y:bounds.y,width:after,height}};
      return result;
    }
    if (fold.width >= width * .6 && fold.height < height * .45) {
      const end = Math.min(height, y + Math.max(fold.height, 12));
      const after = Math.max(0, height - end);
      result.focus = {...bounds,height:y};
      if (!layout.keyboardVisible && y >= 200 && after >= 160) return {...result, arrangement: 'stack', primary: y, gap: end - y};
      return result;
    }
  }
  const library = Math.round(248 * Math.min(scale, 1.35));
  if (layout.nativeChrome && width >= Math.max(650, library + 360 * scale) && height >= 220) {
    return {...result, arrangement: 'column', primary: library};
  }
  return result;
}
