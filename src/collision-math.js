// Earliest contact of a point segment against a horizontal circle.
export function sweepCircle(from,to,center,radius){
 const sx=from.x-center.x,sz=from.z-center.z,dx=to.x-from.x,dz=to.z-from.z,c=sx*sx+sz*sz-radius*radius;
 if(c<=0)return 0;const a=dx*dx+dz*dz;if(a<1e-12)return null;const b=2*(sx*dx+sz*dz),disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
