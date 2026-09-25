// Original implementation of normalized dual-quaternion blending (Kavan et al.).
// Bone matrices are rigid relative to the bind pose; player scale is outside skinning.
const definitions=`
vec4 dqMultiply(vec4 a,vec4 b){return vec4(a.w*b.xyz+b.w*a.xyz+cross(a.xyz,b.xyz),a.w*b.w-dot(a.xyz,b.xyz));}
vec3 dqRotate(vec4 q,vec3 p){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec4 dqRotation(mat4 m){
 float t=m[0][0]+m[1][1]+m[2][2]; vec4 q;
 if(t>0.0){float s=sqrt(t+1.0)*2.0;q=vec4((m[1][2]-m[2][1])/s,(m[2][0]-m[0][2])/s,(m[0][1]-m[1][0])/s,.25*s);}
 else if(m[0][0]>m[1][1]&&m[0][0]>m[2][2]){float s=sqrt(1.0+m[0][0]-m[1][1]-m[2][2])*2.0;q=vec4(.25*s,(m[1][0]+m[0][1])/s,(m[2][0]+m[0][2])/s,(m[1][2]-m[2][1])/s);}
 else if(m[1][1]>m[2][2]){float s=sqrt(1.0+m[1][1]-m[0][0]-m[2][2])*2.0;q=vec4((m[1][0]+m[0][1])/s,.25*s,(m[2][1]+m[1][2])/s,(m[2][0]-m[0][2])/s);}
 else{float s=sqrt(1.0+m[2][2]-m[0][0]-m[1][1])*2.0;q=vec4((m[2][0]+m[0][2])/s,(m[2][1]+m[1][2])/s,.25*s,(m[0][1]-m[1][0])/s);}return normalize(q);
}
`;
export function dualQuaternionShader(shader){
 shader.vertexShader=shader.vertexShader.replace('#include <skinning_pars_vertex>','#include <skinning_pars_vertex>\n'+definitions);
 shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',`#include <skinbase_vertex>
 #ifdef USE_SKINNING
 vec4 r0=dqRotation(boneMatX),r1=dqRotation(boneMatY),r2=dqRotation(boneMatZ),r3=dqRotation(boneMatW);
 r1*=dot(r0,r1)<0.0?-1.0:1.0;r2*=dot(r0,r2)<0.0?-1.0:1.0;r3*=dot(r0,r3)<0.0?-1.0:1.0;
 vec4 dqReal=r0*skinWeight.x+r1*skinWeight.y+r2*skinWeight.z+r3*skinWeight.w;
 vec4 dqDual=.5*(dqMultiply(vec4(boneMatX[3].xyz,0.0),r0)*skinWeight.x+dqMultiply(vec4(boneMatY[3].xyz,0.0),r1)*skinWeight.y+dqMultiply(vec4(boneMatZ[3].xyz,0.0),r2)*skinWeight.z+dqMultiply(vec4(boneMatW[3].xyz,0.0),r3)*skinWeight.w);
 float dqLength=max(length(dqReal),.00001);dqReal/=dqLength;dqDual/=dqLength;
 vec3 dqTranslation=2.0*dqMultiply(dqDual,vec4(-dqReal.xyz,dqReal.w)).xyz;
 #endif`);
 shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>',`#ifdef USE_SKINNING
 objectNormal=mat3(bindMatrixInverse)*dqRotate(dqReal,mat3(bindMatrix)*objectNormal);
 #ifdef USE_TANGENT
 objectTangent=mat3(bindMatrixInverse)*dqRotate(dqReal,mat3(bindMatrix)*objectTangent);
 #endif
 #endif`);
 shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>',`#ifdef USE_SKINNING
 transformed=(bindMatrixInverse*vec4(dqRotate(dqReal,(bindMatrix*vec4(transformed,1.0)).xyz)+dqTranslation,1.0)).xyz;
 #endif`);
}
