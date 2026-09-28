// Face check for player-gallery.html?face=1: the bundled fictional reference athlete
// (src/assets/fictional-player-reference.png, generated, no real person) goes through the editor's own photo
// pipeline -- landmark analysis (src/face-fit.js), the front crop, the bake (src/face-assets.js bakeFaceAsset,
// with the profile photo's points when the detector finds a face in it) -- and the result is put on every head,
// with and without the 3D face shape, plus the new short hair styles. Nothing is saved.
import {defaultFacePhotos} from '../default-face.js';
import {fitPhoto,autoCrop} from '../face-fit.js';
import {bakeFaceAsset,loadImage} from '../face-assets.js';

export async function fictionalFace(){
 const {sources,crops}=await defaultFacePhotos(),front=await loadImage(sources.front),side=await loadImage(sources.side);
 const fit=await fitPhoto(front);
 let sideLandmarks=null,sideError=null;
 try{sideLandmarks=(await fitPhoto(side,true)).landmarks;}catch(e){sideError=e.message;}
 const cropped={...crops,front:fit.points?autoCrop(fit.points,front.width,front.height):crops.front};
 const asset=await bakeFaceAsset(sources,cropped,fit.skin,fit.landmarks,sideLandmarks);
 return {asset,fit,side:{found:!!sideLandmarks,error:sideError}};
}

/** Gallery rows: [label, profile]. `before` rows are what the game drew before this change for the same photo. */
export function faceCheckLine({asset,fit}){
 const photo=(extra)=>({name:'FICTION',number:8,skin:fit.skin,hair:'#141210',hairStyle:'short',beard:'none',height:1.8,
  face:{enabled:true,mode:'sculpt',fitted:true,identity:fit.identity,shape:fit.shape,fitShape:fit.shape},faceTexture:asset.atlas,faceUV:asset.faceUV,...extra});
 const rows=[['before: 서양 A, 사진만',photo({faceBase:'male_02'})],['after: 자동 선택 + 3D 모양',photo({faceShape3d:asset.shape3d})]];
 for(const id of ['male_02','male_03','asian_01','asian_02'])rows.push([`${id} 사진만`,photo({faceBase:id})],[`${id} + 3D 모양`,photo({faceBase:id,faceShape3d:asset.shape3d})]);
 for(const [id,style] of [['male_02','twoblock'],['male_02','sidepart'],['asian_01','twoblock'],['asian_01','sidepart'],['asian_02','twoblock'],['asian_02','sidepart']])
  rows.push([`${id} ${style}`,{name:'HAIR',number:10,skin:'#d9b08c',hair:'#15110e',hairStyle:style,beard:'none',height:1.8,faceBase:id}]);
 return rows;
}
