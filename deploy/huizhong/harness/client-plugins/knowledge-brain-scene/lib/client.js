window.__ModuleLoader__.load({id:"@eiscore/dsh-client-knowledge-brain-scene",factory:()=>{
var brain=(()=>{var ql=Object.defineProperty;var Pm=Object.getOwnPropertyDescriptor;var Dm=Object.getOwnPropertyNames;var Nm=Object.prototype.hasOwnProperty;var Um=(i,e)=>{for(var t in e)ql(i,t,{get:e[t],enumerable:!0})},Om=(i,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of Dm(e))!Nm.call(i,r)&&r!==t&&ql(i,r,{get:()=>e[r],enumerable:!(n=Pm(e,r))||n.enumerable});return i};var Bm=i=>Om(ql({},"__esModule",{value:!0}),i);var f0={};Um(f0,{createBrainStage:()=>m0});var Nn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Br={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},nd=0,Oc=1,rd=2;var Bc=1,id=2,sr=3,ia=0,bn=1,Un=2,Fr=0,ys=1,Fc=2,kc=3,Hc=4,ad=5,aa=100,sd=101,od=102,ld=103,cd=104,hd=200,ud=201,dd=202,pd=203,md=204,fd=205,gd=206,yd=207,vd=208,_d=209,xd=210,Ed=211,Md=212,bd=213,Sd=214,$o=0,Qo=1,el=2,vs=3,tl=4,nl=5,rl=6,il=7,Td=0,wd=1,Ad=2,vr=0,Rd=1,Cd=2,Id=3,Ld=4,Pd=5,Dd=6,Nd=7;var Vc=300,sa=301,ci=302,al=303,sl=304,_s=306,ho=1e3,Wi=1001,uo=1002,Qn=1003,Ud=1004;var xs=1005;var er=1006,ol=1007;var hi=1008;var or=1009,zc=1010,Gc=1011,oa=1012,ll=1013,ui=1014,Xn=1015,la=1016,cl=1017,hl=1018,ca=1020,Wc=35902,Xc=35899,Od=1021,Bd=1022,jn=1023,Es=1026,Ms=1027,ul=1028,dl=1029,Fd=1030,jc=1031;var qc=1033,pl=33776,ml=33777,fl=33778,gl=33779,Yc=35840,Kc=35841,Zc=35842,Jc=35843,$c=36196,Qc=37492,eh=37496,th=37808,nh=37809,rh=37810,ih=37811,ah=37812,sh=37813,oh=37814,lh=37815,ch=37816,hh=37817,uh=37818,dh=37819,ph=37820,mh=37821,fh=36492,gh=36494,yh=36495,vh=36283,_h=36284,xh=36285,Eh=36286;var ka=2300,po=2301,co=2302,bc=2400,Sc=2401,Tc=2402;var kd=3201;var Hd=0,Vd=1,di="",on="srgb",ti="srgb-linear",Ha="linear",vt="srgb";var ei=7680;var zd=512,Gd=513,Wd=514,Mh=515,Xd=516,jd=517,qd=518,Yd=519,wc=35044;var bh="300 es",yr=2e3,Va=2001;var tr=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n!==void 0&&n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let a=r.indexOf(t);a!==-1&&r.splice(a,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let r=n.slice(0);for(let a=0,s=r.length;a<s;a++)r[a].call(this,e);e.target=null}}},Jt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],_u=1234567,zi=Math.PI/180,Xi=180/Math.PI;function pi(){let i=4294967295*Math.random()|0,e=4294967295*Math.random()|0,t=4294967295*Math.random()|0,n=4294967295*Math.random()|0;return(Jt[255&i]+Jt[i>>8&255]+Jt[i>>16&255]+Jt[i>>24&255]+"-"+Jt[255&e]+Jt[e>>8&255]+"-"+Jt[e>>16&15|64]+Jt[e>>24&255]+"-"+Jt[63&t|128]+Jt[t>>8&255]+"-"+Jt[t>>16&255]+Jt[t>>24&255]+Jt[255&n]+Jt[n>>8&255]+Jt[n>>16&255]+Jt[n>>24&255]).toLowerCase()}function Ye(i,e,t){return Math.max(e,Math.min(t,i))}function Ac(i,e){return(i%e+e)%e}function Oa(i,e,t){return(1-t)*i+t*e}function Vi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function sn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(4294967295*i);case Uint16Array:return Math.round(65535*i);case Uint8Array:return Math.round(255*i);case Int32Array:return Math.round(2147483647*i);case Int16Array:return Math.round(32767*i);case Int8Array:return Math.round(127*i);default:throw new Error("Invalid component type.")}}var kr={DEG2RAD:zi,RAD2DEG:Xi,generateUUID:pi,clamp:Ye,euclideanModulo:Ac,mapLinear:function(i,e,t,n,r){return n+(i-e)*(r-n)/(t-e)},inverseLerp:function(i,e,t){return i!==e?(t-i)/(e-i):0},lerp:Oa,damp:function(i,e,t,n){return Oa(i,e,1-Math.exp(-t*n))},pingpong:function(i,e=1){return e-Math.abs(Ac(i,2*e)-e)},smoothstep:function(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e))*i*(3-2*i)},smootherstep:function(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e))*i*i*(i*(6*i-15)+10)},randInt:function(i,e){return i+Math.floor(Math.random()*(e-i+1))},randFloat:function(i,e){return i+Math.random()*(e-i)},randFloatSpread:function(i){return i*(.5-Math.random())},seededRandom:function(i){i!==void 0&&(_u=i);let e=_u+=1831565813;return e=Math.imul(e^e>>>15,1|e),e^=e+Math.imul(e^e>>>7,61|e),((e^e>>>14)>>>0)/4294967296},degToRad:function(i){return i*zi},radToDeg:function(i){return i*Xi},isPowerOfTwo:function(i){return!(i&i-1)&&i!==0},ceilPowerOfTwo:function(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))},floorPowerOfTwo:function(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))},setQuaternionFromProperEuler:function(i,e,t,n,r){let a=Math.cos,s=Math.sin,o=a(t/2),c=s(t/2),l=a((e+n)/2),h=s((e+n)/2),u=a((e-n)/2),d=s((e-n)/2),p=a((n-e)/2),f=s((n-e)/2);switch(r){case"XYX":i.set(o*h,c*u,c*d,o*l);break;case"YZY":i.set(c*d,o*h,c*u,o*l);break;case"ZXZ":i.set(c*u,c*d,o*h,o*l);break;case"XZX":i.set(o*h,c*f,c*p,o*l);break;case"YXY":i.set(c*p,o*h,c*f,o*l);break;case"ZYZ":i.set(c*f,c*p,o*h,o*l);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}},normalize:sn,denormalize:Vi},oe=class i{constructor(e=0,t=0){i.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ye(this.x,e.x,t.x),this.y=Ye(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ye(this.x,e,t),this.y=Ye(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ye(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ye(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),a=this.x-e.x,s=this.y-e.y;return this.x=a*n-s*r+e.x,this.y=a*r+s*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},dn=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,a,s,o){let c=n[r+0],l=n[r+1],h=n[r+2],u=n[r+3],d=a[s+0],p=a[s+1],f=a[s+2],_=a[s+3];if(o===0)return e[t+0]=c,e[t+1]=l,e[t+2]=h,void(e[t+3]=u);if(o===1)return e[t+0]=d,e[t+1]=p,e[t+2]=f,void(e[t+3]=_);if(u!==_||c!==d||l!==p||h!==f){let m=1-o,g=c*d+l*p+h*f+u*_,y=g>=0?1:-1,x=1-g*g;if(x>Number.EPSILON){let L=Math.sqrt(x),I=Math.atan2(L,g*y);m=Math.sin(m*I)/L,o=Math.sin(o*I)/L}let b=o*y;if(c=c*m+d*b,l=l*m+p*b,h=h*m+f*b,u=u*m+_*b,m===1-o){let L=1/Math.sqrt(c*c+l*l+h*h+u*u);c*=L,l*=L,h*=L,u*=L}}e[t]=c,e[t+1]=l,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,a,s){let o=n[r],c=n[r+1],l=n[r+2],h=n[r+3],u=a[s],d=a[s+1],p=a[s+2],f=a[s+3];return e[t]=o*f+h*u+c*p-l*d,e[t+1]=c*f+h*d+l*u-o*p,e[t+2]=l*f+h*p+o*d-c*u,e[t+3]=h*f-o*u-c*d-l*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,a=e._z,s=e._order,o=Math.cos,c=Math.sin,l=o(n/2),h=o(r/2),u=o(a/2),d=c(n/2),p=c(r/2),f=c(a/2);switch(s){case"XYZ":this._x=d*h*u+l*p*f,this._y=l*p*u-d*h*f,this._z=l*h*f+d*p*u,this._w=l*h*u-d*p*f;break;case"YXZ":this._x=d*h*u+l*p*f,this._y=l*p*u-d*h*f,this._z=l*h*f-d*p*u,this._w=l*h*u+d*p*f;break;case"ZXY":this._x=d*h*u-l*p*f,this._y=l*p*u+d*h*f,this._z=l*h*f+d*p*u,this._w=l*h*u-d*p*f;break;case"ZYX":this._x=d*h*u-l*p*f,this._y=l*p*u+d*h*f,this._z=l*h*f-d*p*u,this._w=l*h*u+d*p*f;break;case"YZX":this._x=d*h*u+l*p*f,this._y=l*p*u+d*h*f,this._z=l*h*f-d*p*u,this._w=l*h*u-d*p*f;break;case"XZY":this._x=d*h*u-l*p*f,this._y=l*p*u-d*h*f,this._z=l*h*f+d*p*u,this._w=l*h*u+d*p*f;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+s)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],a=t[8],s=t[1],o=t[5],c=t[9],l=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){let p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-c)*p,this._y=(a-l)*p,this._z=(s-r)*p}else if(n>o&&n>u){let p=2*Math.sqrt(1+n-o-u);this._w=(h-c)/p,this._x=.25*p,this._y=(r+s)/p,this._z=(a+l)/p}else if(o>u){let p=2*Math.sqrt(1+o-n-u);this._w=(a-l)/p,this._x=(r+s)/p,this._y=.25*p,this._z=(c+h)/p}else{let p=2*Math.sqrt(1+u-n-o);this._w=(s-r)/p,this._x=(a+l)/p,this._y=(c+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ye(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,a=e._z,s=e._w,o=t._x,c=t._y,l=t._z,h=t._w;return this._x=n*h+s*o+r*l-a*c,this._y=r*h+s*c+a*o-n*l,this._z=a*h+s*l+n*c-r*o,this._w=s*h-n*o-r*c-a*l,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);let n=this._x,r=this._y,a=this._z,s=this._w,o=s*e._w+n*e._x+r*e._y+a*e._z;if(o<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,o=-o):this.copy(e),o>=1)return this._w=s,this._x=n,this._y=r,this._z=a,this;let c=1-o*o;if(c<=Number.EPSILON){let p=1-t;return this._w=p*s+t*this._w,this._x=p*n+t*this._x,this._y=p*r+t*this._y,this._z=p*a+t*this._z,this.normalize(),this}let l=Math.sqrt(c),h=Math.atan2(l,o),u=Math.sin((1-t)*h)/l,d=Math.sin(t*h)/l;return this._w=s*u+this._w*d,this._x=n*u+this._x*d,this._y=r*u+this._y*d,this._z=a*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),a=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),a*Math.sin(t),a*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},M=class i{constructor(e=0,t=0,n=0){i.prototype.isVector3=!0,this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(xu.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(xu.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,a=e.elements;return this.x=a[0]*t+a[3]*n+a[6]*r,this.y=a[1]*t+a[4]*n+a[7]*r,this.z=a[2]*t+a[5]*n+a[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,a=e.elements,s=1/(a[3]*t+a[7]*n+a[11]*r+a[15]);return this.x=(a[0]*t+a[4]*n+a[8]*r+a[12])*s,this.y=(a[1]*t+a[5]*n+a[9]*r+a[13])*s,this.z=(a[2]*t+a[6]*n+a[10]*r+a[14])*s,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,a=e.x,s=e.y,o=e.z,c=e.w,l=2*(s*r-o*n),h=2*(o*t-a*r),u=2*(a*n-s*t);return this.x=t+c*l+s*u-o*h,this.y=n+c*h+o*l-a*u,this.z=r+c*u+a*h-s*l,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r,this.y=a[1]*t+a[5]*n+a[9]*r,this.z=a[2]*t+a[6]*n+a[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ye(this.x,e.x,t.x),this.y=Ye(this.y,e.y,t.y),this.z=Ye(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ye(this.x,e,t),this.y=Ye(this.y,e,t),this.z=Ye(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ye(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,a=e.z,s=t.x,o=t.y,c=t.z;return this.x=r*c-a*o,this.y=a*s-n*c,this.z=n*o-r*s,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Yl.copy(this).projectOnVector(e),this.sub(Yl)}reflect(e){return this.sub(Yl.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ye(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,4*t)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,3*t)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=2*Math.random()-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Yl=new M,xu=new dn,qe=class i{constructor(e,t,n,r,a,s,o,c,l){i.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,a,s,o,c,l)}set(e,t,n,r,a,s,o,c,l){let h=this.elements;return h[0]=e,h[1]=r,h[2]=o,h[3]=t,h[4]=a,h[5]=c,h[6]=n,h[7]=s,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,a=this.elements,s=n[0],o=n[3],c=n[6],l=n[1],h=n[4],u=n[7],d=n[2],p=n[5],f=n[8],_=r[0],m=r[3],g=r[6],y=r[1],x=r[4],b=r[7],L=r[2],I=r[5],B=r[8];return a[0]=s*_+o*y+c*L,a[3]=s*m+o*x+c*I,a[6]=s*g+o*b+c*B,a[1]=l*_+h*y+u*L,a[4]=l*m+h*x+u*I,a[7]=l*g+h*b+u*B,a[2]=d*_+p*y+f*L,a[5]=d*m+p*x+f*I,a[8]=d*g+p*b+f*B,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],c=e[6],l=e[7],h=e[8];return t*s*h-t*o*l-n*a*h+n*o*c+r*a*l-r*s*c}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],c=e[6],l=e[7],h=e[8],u=h*s-o*l,d=o*c-h*a,p=l*a-s*c,f=t*u+n*d+r*p;if(f===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/f;return e[0]=u*_,e[1]=(r*l-h*n)*_,e[2]=(o*n-r*s)*_,e[3]=d*_,e[4]=(h*t-r*c)*_,e[5]=(r*a-o*t)*_,e[6]=p*_,e[7]=(n*c-l*t)*_,e[8]=(s*t-n*a)*_,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,a,s,o){let c=Math.cos(a),l=Math.sin(a);return this.set(n*c,n*l,-n*(c*s+l*o)+s+e,-r*l,r*c,-r*(-l*s+c*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(Kl.makeScale(e,t)),this}rotate(e){return this.premultiply(Kl.makeRotation(-e)),this}translate(e,t){return this.premultiply(Kl.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Kl=new qe;function Sh(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function za(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Kd(){let i=za("canvas");return i.style.display="block",i}var Eu={};function ji(i){i in Eu||(Eu[i]=!0,console.warn(i))}function Zd(i,e,t){return new Promise(function(n,r){setTimeout(function a(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:r();break;case i.TIMEOUT_EXPIRED:setTimeout(a,t);break;default:n()}},t)})}var Mu=new qe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),bu=new qe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Fm(){let i={enabled:!0,workingColorSpace:ti,spaces:{},convert:function(r,a,s){return this.enabled!==!1&&a!==s&&a&&s&&(this.spaces[a].transfer===vt&&(r.r=gr(r.r),r.g=gr(r.g),r.b=gr(r.b)),this.spaces[a].primaries!==this.spaces[s].primaries&&(r.applyMatrix3(this.spaces[a].toXYZ),r.applyMatrix3(this.spaces[s].fromXYZ)),this.spaces[s].transfer===vt&&(r.r=Gi(r.r),r.g=Gi(r.g),r.b=Gi(r.b))),r},workingToColorSpace:function(r,a){return this.convert(r,this.workingColorSpace,a)},colorSpaceToWorking:function(r,a){return this.convert(r,a,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===""?Ha:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,a=this.workingColorSpace){return r.fromArray(this.spaces[a].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,a,s){return r.copy(this.spaces[a].toXYZ).multiply(this.spaces[s].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,a){return ji("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(r,a)},toWorkingColorSpace:function(r,a){return ji("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(r,a)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[ti]:{primaries:e,whitePoint:n,transfer:Ha,toXYZ:Mu,fromXYZ:bu,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:on},outputColorSpaceConfig:{drawingBufferColorSpace:on}},[on]:{primaries:e,whitePoint:n,transfer:vt,toXYZ:Mu,fromXYZ:bu,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:on}}}),i}var st=Fm();function gr(i){return i<.04045?.0773993808*i:Math.pow(.9478672986*i+.0521327014,2.4)}function Gi(i){return i<.0031308?12.92*i:1.055*Math.pow(i,.41666)-.055}var Ci,mo=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Ci===void 0&&(Ci=za("canvas")),Ci.width=e.width,Ci.height=e.height;let r=Ci.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),n=Ci}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=za("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),a=r.data;for(let s=0;s<a.length;s++)a[s]=255*gr(a[s]/255);return n.putImageData(r,0,0),t}if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(255*gr(t[n]/255)):t[n]=gr(t[n]);return{data:t,width:e.width,height:e.height}}return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},km=0,qi=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:km++}),this.uuid=pi(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let a;if(Array.isArray(r)){a=[];for(let s=0,o=r.length;s<o;s++)r[s].isDataTexture?a.push(Zl(r[s].image)):a.push(Zl(r[s]))}else a=Zl(r);n.url=a}return t||(e.images[this.uuid]=n),n}};function Zl(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?mo.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}var Hm=0,Jl=new M,un=class i extends tr{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=1001,r=1001,a=1006,s=1008,o=1023,c=1009,l=i.DEFAULT_ANISOTROPY,h=""){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Hm++}),this.uuid=pi(),this.name="",this.source=new qi(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=a,this.minFilter=s,this.anisotropy=l,this.format=o,this.internalFormat=null,this.type=c,this.offset=new oe(0,0),this.repeat=new oe(1,1),this.center=new oe(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new qe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Jl).x}get height(){return this.source.getSize(Jl).y}get depth(){return this.source.getSize(Jl).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];r!==void 0?r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n:console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`)}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Vc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ho:e.x=e.x-Math.floor(e.x);break;case Wi:e.x=e.x<0?0:1;break;case uo:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x)}if(e.y<0||e.y>1)switch(this.wrapT){case ho:e.y=e.y-Math.floor(e.y);break;case Wi:e.y=e.y<0?0:1;break;case uo:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y)}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};un.DEFAULT_IMAGE=null,un.DEFAULT_MAPPING=Vc,un.DEFAULT_ANISOTROPY=1;var Rt=class i{constructor(e=0,t=0,n=0,r=1){i.prototype.isVector4=!0,this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,a=this.w,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r+s[12]*a,this.y=s[1]*t+s[5]*n+s[9]*r+s[13]*a,this.z=s[2]*t+s[6]*n+s[10]*r+s[14]*a,this.w=s[3]*t+s[7]*n+s[11]*r+s[15]*a,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,a,c=e.elements,l=c[0],h=c[4],u=c[8],d=c[1],p=c[5],f=c[9],_=c[2],m=c[6],g=c[10];if(Math.abs(h-d)<.01&&Math.abs(u-_)<.01&&Math.abs(f-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+_)<.1&&Math.abs(f+m)<.1&&Math.abs(l+p+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let x=(l+1)/2,b=(p+1)/2,L=(g+1)/2,I=(h+d)/4,B=(u+_)/4,G=(f+m)/4;return x>b&&x>L?x<.01?(n=0,r=.707106781,a=.707106781):(n=Math.sqrt(x),r=I/n,a=B/n):b>L?b<.01?(n=.707106781,r=0,a=.707106781):(r=Math.sqrt(b),n=I/r,a=G/r):L<.01?(n=.707106781,r=.707106781,a=0):(a=Math.sqrt(L),n=B/a,r=G/a),this.set(n,r,a,t),this}let y=Math.sqrt((m-f)*(m-f)+(u-_)*(u-_)+(d-h)*(d-h));return Math.abs(y)<.001&&(y=1),this.x=(m-f)/y,this.y=(u-_)/y,this.z=(d-h)/y,this.w=Math.acos((l+p+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ye(this.x,e.x,t.x),this.y=Ye(this.y,e.y,t.y),this.z=Ye(this.z,e.z,t.z),this.w=Ye(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ye(this.x,e,t),this.y=Ye(this.y,e,t),this.z=Ye(this.z,e,t),this.w=Ye(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ye(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},fo=class extends tr{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:er,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Rt(0,0,e,t),this.scissorTest=!1,this.viewport=new Rt(0,0,e,t);let r={width:e,height:t,depth:n.depth},a=new un(r);this.textures=[];let s=n.count;for(let o=0;o<s;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){let t={minFilter:er,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,a=this.textures.length;r<a;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isArrayTexture=this.textures[r].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new qi(r)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}},nr=class extends fo{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Ga=class extends un{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Qn,this.minFilter=Qn,this.wrapR=Wi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var go=class extends un{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Qn,this.minFilter=Qn,this.wrapR=Wi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var In=class{constructor(e=new M(1/0,1/0,1/0),t=new M(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Hn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Hn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Hn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let a=n.getAttribute("position");if(t===!0&&a!==void 0&&e.isInstancedMesh!==!0)for(let s=0,o=a.count;s<o;s++)e.isMesh===!0?e.getVertexPosition(s,Hn):Hn.fromBufferAttribute(a,s),Hn.applyMatrix4(e.matrixWorld),this.expandByPoint(Hn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Ds.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ds.copy(n.boundingBox)),Ds.applyMatrix4(e.matrixWorld),this.union(Ds)}let r=e.children;for(let a=0,s=r.length;a<s;a++)this.expandByObject(r[a],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Hn),Hn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ra),Ns.subVectors(this.max,Ra),Ii.subVectors(e.a,Ra),Li.subVectors(e.b,Ra),Pi.subVectors(e.c,Ra),Sr.subVectors(Li,Ii),Tr.subVectors(Pi,Li),Zr.subVectors(Ii,Pi);let t=[0,-Sr.z,Sr.y,0,-Tr.z,Tr.y,0,-Zr.z,Zr.y,Sr.z,0,-Sr.x,Tr.z,0,-Tr.x,Zr.z,0,-Zr.x,-Sr.y,Sr.x,0,-Tr.y,Tr.x,0,-Zr.y,Zr.x,0];return!!$l(t,Ii,Li,Pi,Ns)&&(t=[1,0,0,0,1,0,0,0,1],!!$l(t,Ii,Li,Pi,Ns)&&(Us.crossVectors(Sr,Tr),t=[Us.x,Us.y,Us.z],$l(t,Ii,Li,Pi,Ns)))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Hn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=.5*this.getSize(Hn).length()),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()||(hr[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),hr[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),hr[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),hr[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),hr[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),hr[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),hr[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),hr[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(hr)),this}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},hr=[new M,new M,new M,new M,new M,new M,new M,new M],Hn=new M,Ds=new In,Ii=new M,Li=new M,Pi=new M,Sr=new M,Tr=new M,Zr=new M,Ra=new M,Ns=new M,Us=new M,Jr=new M;function $l(i,e,t,n,r){for(let a=0,s=i.length-3;a<=s;a+=3){Jr.fromArray(i,a);let o=r.x*Math.abs(Jr.x)+r.y*Math.abs(Jr.y)+r.z*Math.abs(Jr.z),c=e.dot(Jr),l=t.dot(Jr),h=n.dot(Jr);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>o)return!1}return!0}var Vm=new In,Ca=new M,Ql=new M,Ln=class{constructor(e=new M,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):Vm.setFromPoints(e).getCenter(n);let r=0;for(let a=0,s=e.length;a<s;a++)r=Math.max(r,n.distanceToSquared(e[a]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ca.subVectors(e,this.center);let t=Ca.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),r=.5*(n-this.radius);this.center.addScaledVector(Ca,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ql.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ca.copy(e.center).add(Ql)),this.expandByPoint(Ca.copy(e.center).sub(Ql))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},ur=new M,ec=new M,Os=new M,wr=new M,tc=new M,Bs=new M,nc=new M,rr=class{constructor(e=new M,t=new M(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ur)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ur.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ur.copy(this.origin).addScaledVector(this.direction,t),ur.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){ec.copy(e).add(t).multiplyScalar(.5),Os.copy(t).sub(e).normalize(),wr.copy(this.origin).sub(ec);let a=.5*e.distanceTo(t),s=-this.direction.dot(Os),o=wr.dot(this.direction),c=-wr.dot(Os),l=wr.lengthSq(),h=Math.abs(1-s*s),u,d,p,f;if(h>0)if(u=s*c-o,d=s*o-c,f=a*h,u>=0)if(d>=-f)if(d<=f){let _=1/h;u*=_,d*=_,p=u*(u+s*d+2*o)+d*(s*u+d+2*c)+l}else d=a,u=Math.max(0,-(s*d+o)),p=-u*u+d*(d+2*c)+l;else d=-a,u=Math.max(0,-(s*d+o)),p=-u*u+d*(d+2*c)+l;else d<=-f?(u=Math.max(0,-(-s*a+o)),d=u>0?-a:Math.min(Math.max(-a,-c),a),p=-u*u+d*(d+2*c)+l):d<=f?(u=0,d=Math.min(Math.max(-a,-c),a),p=d*(d+2*c)+l):(u=Math.max(0,-(s*a+o)),d=u>0?a:Math.min(Math.max(-a,-c),a),p=-u*u+d*(d+2*c)+l);else d=s>0?-a:a,u=Math.max(0,-(s*d+o)),p=-u*u+d*(d+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(ec).addScaledVector(Os,d),p}intersectSphere(e,t){ur.subVectors(e.center,this.origin);let n=ur.dot(this.direction),r=ur.dot(ur)-n*n,a=e.radius*e.radius;if(r>a)return null;let s=Math.sqrt(a-r),o=n-s,c=n+s;return c<0?null:o<0?this.at(c,t):this.at(o,t)}intersectsSphere(e){return!(e.radius<0)&&this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0?!0:e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,a,s,o,c,l=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return l>=0?(n=(e.min.x-d.x)*l,r=(e.max.x-d.x)*l):(n=(e.max.x-d.x)*l,r=(e.min.x-d.x)*l),h>=0?(a=(e.min.y-d.y)*h,s=(e.max.y-d.y)*h):(a=(e.max.y-d.y)*h,s=(e.min.y-d.y)*h),n>s||a>r?null:((a>n||isNaN(n))&&(n=a),(s<r||isNaN(r))&&(r=s),u>=0?(o=(e.min.z-d.z)*u,c=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,c=(e.min.z-d.z)*u),n>c||o>r?null:((o>n||n!=n)&&(n=o),(c<r||r!=r)&&(r=c),r<0?null:this.at(n>=0?n:r,t)))}intersectsBox(e){return this.intersectBox(e,ur)!==null}intersectTriangle(e,t,n,r,a){tc.subVectors(t,e),Bs.subVectors(n,e),nc.crossVectors(tc,Bs);let s,o=this.direction.dot(nc);if(o>0){if(r)return null;s=1}else{if(!(o<0))return null;s=-1,o=-o}wr.subVectors(this.origin,e);let c=s*this.direction.dot(Bs.crossVectors(wr,Bs));if(c<0)return null;let l=s*this.direction.dot(tc.cross(wr));if(l<0||c+l>o)return null;let h=-s*wr.dot(nc);return h<0?null:this.at(h/o,a)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ke=class i{constructor(e,t,n,r,a,s,o,c,l,h,u,d,p,f,_,m){i.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,a,s,o,c,l,h,u,d,p,f,_,m)}set(e,t,n,r,a,s,o,c,l,h,u,d,p,f,_,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=a,g[5]=s,g[9]=o,g[13]=c,g[2]=l,g[6]=h,g[10]=u,g[14]=d,g[3]=p,g[7]=f,g[11]=_,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){let t=this.elements,n=e.elements,r=1/Di.setFromMatrixColumn(e,0).length(),a=1/Di.setFromMatrixColumn(e,1).length(),s=1/Di.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=0,t[8]=n[8]*s,t[9]=n[9]*s,t[10]=n[10]*s,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,a=e.z,s=Math.cos(n),o=Math.sin(n),c=Math.cos(r),l=Math.sin(r),h=Math.cos(a),u=Math.sin(a);if(e.order==="XYZ"){let d=s*h,p=s*u,f=o*h,_=o*u;t[0]=c*h,t[4]=-c*u,t[8]=l,t[1]=p+f*l,t[5]=d-_*l,t[9]=-o*c,t[2]=_-d*l,t[6]=f+p*l,t[10]=s*c}else if(e.order==="YXZ"){let d=c*h,p=c*u,f=l*h,_=l*u;t[0]=d+_*o,t[4]=f*o-p,t[8]=s*l,t[1]=s*u,t[5]=s*h,t[9]=-o,t[2]=p*o-f,t[6]=_+d*o,t[10]=s*c}else if(e.order==="ZXY"){let d=c*h,p=c*u,f=l*h,_=l*u;t[0]=d-_*o,t[4]=-s*u,t[8]=f+p*o,t[1]=p+f*o,t[5]=s*h,t[9]=_-d*o,t[2]=-s*l,t[6]=o,t[10]=s*c}else if(e.order==="ZYX"){let d=s*h,p=s*u,f=o*h,_=o*u;t[0]=c*h,t[4]=f*l-p,t[8]=d*l+_,t[1]=c*u,t[5]=_*l+d,t[9]=p*l-f,t[2]=-l,t[6]=o*c,t[10]=s*c}else if(e.order==="YZX"){let d=s*c,p=s*l,f=o*c,_=o*l;t[0]=c*h,t[4]=_-d*u,t[8]=f*u+p,t[1]=u,t[5]=s*h,t[9]=-o*h,t[2]=-l*h,t[6]=p*u+f,t[10]=d-_*u}else if(e.order==="XZY"){let d=s*c,p=s*l,f=o*c,_=o*l;t[0]=c*h,t[4]=-u,t[8]=l*h,t[1]=d*u+_,t[5]=s*h,t[9]=p*u-f,t[2]=f*u-p,t[6]=o*h,t[10]=_*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(zm,e,Gm)}lookAt(e,t,n){let r=this.elements;return yn.subVectors(e,t),yn.lengthSq()===0&&(yn.z=1),yn.normalize(),Ar.crossVectors(n,yn),Ar.lengthSq()===0&&(Math.abs(n.z)===1?yn.x+=1e-4:yn.z+=1e-4,yn.normalize(),Ar.crossVectors(n,yn)),Ar.normalize(),Fs.crossVectors(yn,Ar),r[0]=Ar.x,r[4]=Fs.x,r[8]=yn.x,r[1]=Ar.y,r[5]=Fs.y,r[9]=yn.y,r[2]=Ar.z,r[6]=Fs.z,r[10]=yn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,a=this.elements,s=n[0],o=n[4],c=n[8],l=n[12],h=n[1],u=n[5],d=n[9],p=n[13],f=n[2],_=n[6],m=n[10],g=n[14],y=n[3],x=n[7],b=n[11],L=n[15],I=r[0],B=r[4],G=r[8],F=r[12],j=r[1],K=r[5],z=r[9],Z=r[13],X=r[2],Q=r[6],ie=r[10],pe=r[14],ae=r[3],Se=r[7],Pe=r[11],ve=r[15];return a[0]=s*I+o*j+c*X+l*ae,a[4]=s*B+o*K+c*Q+l*Se,a[8]=s*G+o*z+c*ie+l*Pe,a[12]=s*F+o*Z+c*pe+l*ve,a[1]=h*I+u*j+d*X+p*ae,a[5]=h*B+u*K+d*Q+p*Se,a[9]=h*G+u*z+d*ie+p*Pe,a[13]=h*F+u*Z+d*pe+p*ve,a[2]=f*I+_*j+m*X+g*ae,a[6]=f*B+_*K+m*Q+g*Se,a[10]=f*G+_*z+m*ie+g*Pe,a[14]=f*F+_*Z+m*pe+g*ve,a[3]=y*I+x*j+b*X+L*ae,a[7]=y*B+x*K+b*Q+L*Se,a[11]=y*G+x*z+b*ie+L*Pe,a[15]=y*F+x*Z+b*pe+L*ve,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],a=e[12],s=e[1],o=e[5],c=e[9],l=e[13],h=e[2],u=e[6],d=e[10],p=e[14];return e[3]*(+a*c*u-r*l*u-a*o*d+n*l*d+r*o*p-n*c*p)+e[7]*(+t*c*p-t*l*d+a*s*d-r*s*p+r*l*h-a*c*h)+e[11]*(+t*l*u-t*o*p-a*s*u+n*s*p+a*o*h-n*l*h)+e[15]*(-r*o*h-t*c*u+t*o*d+r*s*u-n*s*d+n*c*h)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],a=e[3],s=e[4],o=e[5],c=e[6],l=e[7],h=e[8],u=e[9],d=e[10],p=e[11],f=e[12],_=e[13],m=e[14],g=e[15],y=u*m*l-_*d*l+_*c*p-o*m*p-u*c*g+o*d*g,x=f*d*l-h*m*l-f*c*p+s*m*p+h*c*g-s*d*g,b=h*_*l-f*u*l+f*o*p-s*_*p-h*o*g+s*u*g,L=f*u*c-h*_*c-f*o*d+s*_*d+h*o*m-s*u*m,I=t*y+n*x+r*b+a*L;if(I===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let B=1/I;return e[0]=y*B,e[1]=(_*d*a-u*m*a-_*r*p+n*m*p+u*r*g-n*d*g)*B,e[2]=(o*m*a-_*c*a+_*r*l-n*m*l-o*r*g+n*c*g)*B,e[3]=(u*c*a-o*d*a-u*r*l+n*d*l+o*r*p-n*c*p)*B,e[4]=x*B,e[5]=(h*m*a-f*d*a+f*r*p-t*m*p-h*r*g+t*d*g)*B,e[6]=(f*c*a-s*m*a-f*r*l+t*m*l+s*r*g-t*c*g)*B,e[7]=(s*d*a-h*c*a+h*r*l-t*d*l-s*r*p+t*c*p)*B,e[8]=b*B,e[9]=(f*u*a-h*_*a-f*n*p+t*_*p+h*n*g-t*u*g)*B,e[10]=(s*_*a-f*o*a+f*n*l-t*_*l-s*n*g+t*o*g)*B,e[11]=(h*o*a-s*u*a-h*n*l+t*u*l+s*n*p-t*o*p)*B,e[12]=L*B,e[13]=(h*_*r-f*u*r+f*n*d-t*_*d-h*n*m+t*u*m)*B,e[14]=(f*o*r-s*_*r-f*n*c+t*_*c+s*n*m-t*o*m)*B,e[15]=(s*u*r-h*o*r+h*n*c-t*u*c-s*n*d+t*o*d)*B,this}scale(e){let t=this.elements,n=e.x,r=e.y,a=e.z;return t[0]*=n,t[4]*=r,t[8]*=a,t[1]*=n,t[5]*=r,t[9]*=a,t[2]*=n,t[6]*=r,t[10]*=a,t[3]*=n,t[7]*=r,t[11]*=a,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),a=1-n,s=e.x,o=e.y,c=e.z,l=a*s,h=a*o;return this.set(l*s+n,l*o-r*c,l*c+r*o,0,l*o+r*c,h*o+n,h*c-r*s,0,l*c-r*o,h*c+r*s,a*c*c+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,a,s){return this.set(1,n,a,0,e,1,s,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,a=t._x,s=t._y,o=t._z,c=t._w,l=a+a,h=s+s,u=o+o,d=a*l,p=a*h,f=a*u,_=s*h,m=s*u,g=o*u,y=c*l,x=c*h,b=c*u,L=n.x,I=n.y,B=n.z;return r[0]=(1-(_+g))*L,r[1]=(p+b)*L,r[2]=(f-x)*L,r[3]=0,r[4]=(p-b)*I,r[5]=(1-(d+g))*I,r[6]=(m+y)*I,r[7]=0,r[8]=(f+x)*B,r[9]=(m-y)*B,r[10]=(1-(d+_))*B,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements,a=Di.set(r[0],r[1],r[2]).length(),s=Di.set(r[4],r[5],r[6]).length(),o=Di.set(r[8],r[9],r[10]).length();this.determinant()<0&&(a=-a),e.x=r[12],e.y=r[13],e.z=r[14],Vn.copy(this);let c=1/a,l=1/s,h=1/o;return Vn.elements[0]*=c,Vn.elements[1]*=c,Vn.elements[2]*=c,Vn.elements[4]*=l,Vn.elements[5]*=l,Vn.elements[6]*=l,Vn.elements[8]*=h,Vn.elements[9]*=h,Vn.elements[10]*=h,t.setFromRotationMatrix(Vn),n.x=a,n.y=s,n.z=o,this}makePerspective(e,t,n,r,a,s,o=2e3,c=!1){let l=this.elements,h=2*a/(t-e),u=2*a/(n-r),d=(t+e)/(t-e),p=(n+r)/(n-r),f,_;if(c)f=a/(s-a),_=s*a/(s-a);else if(o===yr)f=-(s+a)/(s-a),_=-2*s*a/(s-a);else{if(o!==Va)throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);f=-s/(s-a),_=-s*a/(s-a)}return l[0]=h,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=u,l[9]=p,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=_,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(e,t,n,r,a,s,o=2e3,c=!1){let l=this.elements,h=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),p=-(n+r)/(n-r),f,_;if(c)f=1/(s-a),_=s/(s-a);else if(o===yr)f=-2/(s-a),_=-(s+a)/(s-a);else{if(o!==Va)throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);f=-1/(s-a),_=-a/(s-a)}return l[0]=h,l[4]=0,l[8]=0,l[12]=d,l[1]=0,l[5]=u,l[9]=0,l[13]=p,l[2]=0,l[6]=0,l[10]=f,l[14]=_,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Di=new M,Vn=new Ke,zm=new M(0,0,0),Gm=new M(1,1,1),Ar=new M,Fs=new M,yn=new M,Su=new Ke,Tu=new dn,Pn=class i{constructor(e=0,t=0,n=0,r=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,a=r[0],s=r[4],o=r[8],c=r[1],l=r[5],h=r[9],u=r[2],d=r[6],p=r[10];switch(t){case"XYZ":this._y=Math.asin(Ye(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-s,a)):(this._x=Math.atan2(d,l),this._z=0);break;case"YXZ":this._x=Math.asin(-Ye(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-u,a),this._z=0);break;case"ZXY":this._x=Math.asin(Ye(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-s,l)):(this._y=0,this._z=Math.atan2(c,a));break;case"ZYX":this._y=Math.asin(-Ye(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(c,a)):(this._x=0,this._z=Math.atan2(-s,l));break;case"YZX":this._z=Math.asin(Ye(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-u,a)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-Ye(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(d,l),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,p),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Su.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Su,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Tu.setFromEuler(this),this.setFromQuaternion(Tu,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Pn.DEFAULT_ORDER="XYZ";var Yi=class{constructor(){this.mask=1}set(e){this.mask=1<<e>>>0}enable(e){this.mask|=1<<e}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e}disable(e){this.mask&=~(1<<e)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return!!(this.mask&1<<e)}},Wm=0,wu=new M,Ni=new dn,dr=new Ke,ks=new M,Ia=new M,Xm=new M,jm=new dn,Au=new M(1,0,0),Ru=new M(0,1,0),Cu=new M(0,0,1),Iu={type:"added"},qm={type:"removed"},Ui={type:"childadded",child:null},rc={type:"childremoved",child:null},At=class i extends tr{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Wm++}),this.uuid=pi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new M,t=new Pn,n=new dn,r=new M(1,1,1);t._onChange(function(){n.setFromEuler(t,!1)}),n._onChange(function(){t.setFromQuaternion(n,void 0,!1)}),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Ke},normalMatrix:{value:new qe}}),this.matrix=new Ke,this.matrixWorld=new Ke,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Yi,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ni.setFromAxisAngle(e,t),this.quaternion.multiply(Ni),this}rotateOnWorldAxis(e,t){return Ni.setFromAxisAngle(e,t),this.quaternion.premultiply(Ni),this}rotateX(e){return this.rotateOnAxis(Au,e)}rotateY(e){return this.rotateOnAxis(Ru,e)}rotateZ(e){return this.rotateOnAxis(Cu,e)}translateOnAxis(e,t){return wu.copy(e).applyQuaternion(this.quaternion),this.position.add(wu.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Au,e)}translateY(e){return this.translateOnAxis(Ru,e)}translateZ(e){return this.translateOnAxis(Cu,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(dr.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ks.copy(e):ks.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Ia.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?dr.lookAt(Ia,ks,this.up):dr.lookAt(ks,Ia,this.up),this.quaternion.setFromRotationMatrix(dr),r&&(dr.extractRotation(r.matrixWorld),Ni.setFromRotationMatrix(dr),this.quaternion.premultiply(Ni.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Iu),Ui.child=e,this.dispatchEvent(Ui),Ui.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(qm),rc.child=e,this.dispatchEvent(rc),rc.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),dr.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),dr.multiply(e.parent.matrixWorld)),e.applyMatrix4(dr),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Iu),Ui.child=e,this.dispatchEvent(Ui),Ui.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let a=0,s=r.length;a<s;a++)r[a].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ia,e,Xm),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ia,jm,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let r=this.children;for(let a=0,s=r.length;a<s;a++)r[a].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};function a(o,c){return o[c.uuid]===void 0&&(o[c.uuid]=c.toJSON(e)),c.uuid}if(r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON())),this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=a(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let c=o.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){let u=c[l];a(e.shapes,u)}else a(e.shapes,c)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let c=0,l=this.material.length;c<l;c++)o.push(a(e.materials,this.material[c]));r.material=o}else r.material=a(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){let c=this.animations[o];r.animations.push(a(e.animations,c))}}if(t){let o=s(e.geometries),c=s(e.materials),l=s(e.textures),h=s(e.images),u=s(e.shapes),d=s(e.skeletons),p=s(e.animations),f=s(e.nodes);o.length>0&&(n.geometries=o),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),f.length>0&&(n.nodes=f)}return n.object=r,n;function s(o){let c=[];for(let l in o){let h=o[l];delete h.metadata,c.push(h)}return c}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let r=e.children[n];this.add(r.clone())}return this}};At.DEFAULT_UP=new M(0,1,0),At.DEFAULT_MATRIX_AUTO_UPDATE=!0,At.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var zn=new M,pr=new M,ic=new M,mr=new M,Oi=new M,Bi=new M,Lu=new M,ac=new M,sc=new M,oc=new M,lc=new Rt,cc=new Rt,hc=new Rt,fr=class i{constructor(e=new M,t=new M,n=new M){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),zn.subVectors(e,t),r.cross(zn);let a=r.lengthSq();return a>0?r.multiplyScalar(1/Math.sqrt(a)):r.set(0,0,0)}static getBarycoord(e,t,n,r,a){zn.subVectors(r,t),pr.subVectors(n,t),ic.subVectors(e,t);let s=zn.dot(zn),o=zn.dot(pr),c=zn.dot(ic),l=pr.dot(pr),h=pr.dot(ic),u=s*l-o*o;if(u===0)return a.set(0,0,0),null;let d=1/u,p=(l*c-o*h)*d,f=(s*h-o*c)*d;return a.set(1-p-f,f,p)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,mr)!==null&&mr.x>=0&&mr.y>=0&&mr.x+mr.y<=1}static getInterpolation(e,t,n,r,a,s,o,c){return this.getBarycoord(e,t,n,r,mr)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(a,mr.x),c.addScaledVector(s,mr.y),c.addScaledVector(o,mr.z),c)}static getInterpolatedAttribute(e,t,n,r,a,s){return lc.setScalar(0),cc.setScalar(0),hc.setScalar(0),lc.fromBufferAttribute(e,t),cc.fromBufferAttribute(e,n),hc.fromBufferAttribute(e,r),s.setScalar(0),s.addScaledVector(lc,a.x),s.addScaledVector(cc,a.y),s.addScaledVector(hc,a.z),s}static isFrontFacing(e,t,n,r){return zn.subVectors(n,t),pr.subVectors(e,t),zn.cross(pr).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return zn.subVectors(this.c,this.b),pr.subVectors(this.a,this.b),.5*zn.cross(pr).length()}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,r,a){return i.getInterpolation(e,this.a,this.b,this.c,t,n,r,a)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,a=this.c,s,o;Oi.subVectors(r,n),Bi.subVectors(a,n),ac.subVectors(e,n);let c=Oi.dot(ac),l=Bi.dot(ac);if(c<=0&&l<=0)return t.copy(n);sc.subVectors(e,r);let h=Oi.dot(sc),u=Bi.dot(sc);if(h>=0&&u<=h)return t.copy(r);let d=c*u-h*l;if(d<=0&&c>=0&&h<=0)return s=c/(c-h),t.copy(n).addScaledVector(Oi,s);oc.subVectors(e,a);let p=Oi.dot(oc),f=Bi.dot(oc);if(f>=0&&p<=f)return t.copy(a);let _=p*l-c*f;if(_<=0&&l>=0&&f<=0)return o=l/(l-f),t.copy(n).addScaledVector(Bi,o);let m=h*f-p*u;if(m<=0&&u-h>=0&&p-f>=0)return Lu.subVectors(a,r),o=(u-h)/(u-h+(p-f)),t.copy(r).addScaledVector(Lu,o);let g=1/(m+_+d);return s=_*g,o=d*g,t.copy(n).addScaledVector(Oi,s).addScaledVector(Bi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Jd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Rr={h:0,s:0,l:0},Hs={h:0,s:0,l:0};function uc(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+6*(e-i)*t:t<.5?e:t<2/3?i+6*(e-i)*(2/3-t):i}var ke=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=on){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(255&e)/255,st.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=st.workingColorSpace){return this.r=e,this.g=t,this.b=n,st.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=st.workingColorSpace){if(e=Ac(e,1),t=Ye(t,0,1),n=Ye(n,0,1),t===0)this.r=this.g=this.b=n;else{let a=n<=.5?n*(1+t):n+t-n*t,s=2*n-a;this.r=uc(s,a,e+1/3),this.g=uc(s,a,e),this.b=uc(s,a,e-1/3)}return st.colorSpaceToWorking(this,r),this}setStyle(e,t=on){function n(a){a!==void 0&&parseFloat(a)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let a,s=r[1],o=r[2];switch(s){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,t);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,t);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let a=r[1],s=a.length;if(s===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,t);if(s===6)return this.setHex(parseInt(a,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=on){let n=Jd[e.toLowerCase()];return n!==void 0?this.setHex(n,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=gr(e.r),this.g=gr(e.g),this.b=gr(e.b),this}copyLinearToSRGB(e){return this.r=Gi(e.r),this.g=Gi(e.g),this.b=Gi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=on){return st.workingToColorSpace($t.copy(this),e),65536*Math.round(Ye(255*$t.r,0,255))+256*Math.round(Ye(255*$t.g,0,255))+Math.round(Ye(255*$t.b,0,255))}getHexString(e=on){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=st.workingColorSpace){st.workingToColorSpace($t.copy(this),t);let n=$t.r,r=$t.g,a=$t.b,s=Math.max(n,r,a),o=Math.min(n,r,a),c,l,h=(o+s)/2;if(o===s)c=0,l=0;else{let u=s-o;switch(l=h<=.5?u/(s+o):u/(2-s-o),s){case n:c=(r-a)/u+(r<a?6:0);break;case r:c=(a-n)/u+2;break;case a:c=(n-r)/u+4}c/=6}return e.h=c,e.s=l,e.l=h,e}getRGB(e,t=st.workingColorSpace){return st.workingToColorSpace($t.copy(this),t),e.r=$t.r,e.g=$t.g,e.b=$t.b,e}getStyle(e=on){st.workingToColorSpace($t.copy(this),e);let t=$t.r,n=$t.g,r=$t.b;return e!==on?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(255*t)},${Math.round(255*n)},${Math.round(255*r)})`}offsetHSL(e,t,n){return this.getHSL(Rr),this.setHSL(Rr.h+e,Rr.s+t,Rr.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Rr),e.getHSL(Hs);let n=Oa(Rr.h,Hs.h,t),r=Oa(Rr.s,Hs.s,t),a=Oa(Rr.l,Hs.l,t);return this.setHSL(n,r,a),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,a=e.elements;return this.r=a[0]*t+a[3]*n+a[6]*r,this.g=a[1]*t+a[4]*n+a[7]*r,this.b=a[2]*t+a[5]*n+a[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},$t=new ke;ke.NAMES=Jd;var Ym=0,Gn=class extends tr{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ym++}),this.uuid=pi(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ke(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=ei,this.stencilZFail=ei,this.stencilZPass=ei,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];r!==void 0?r&&r.isColor?r.set(n):r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n:console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`)}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};function r(a){let s=[];for(let o in a){let c=a[o];delete c.metadata,s.push(c)}return s}if(n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==ei&&(n.stencilFail=this.stencilFail),this.stencilZFail!==ei&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==ei&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData),t){let a=r(e.textures),s=r(e.images);a.length>0&&(n.textures=a),s.length>0&&(n.images=s)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let r=t.length;n=new Array(r);for(let a=0;a!==r;++a)n[a]=t[a].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},xn=class extends Gn{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},_0=Km();function Km(){let i=new ArrayBuffer(4),e=new Float32Array(i),t=new Uint32Array(i),n=new Uint32Array(512),r=new Uint32Array(512);for(let c=0;c<256;++c){let l=c-127;l<-27?(n[c]=0,n[256|c]=32768,r[c]=24,r[256|c]=24):l<-14?(n[c]=1024>>-l-14,n[256|c]=1024>>-l-14|32768,r[c]=-l-1,r[256|c]=-l-1):l<=15?(n[c]=l+15<<10,n[256|c]=l+15<<10|32768,r[c]=13,r[256|c]=13):l<128?(n[c]=31744,n[256|c]=64512,r[c]=24,r[256|c]=24):(n[c]=31744,n[256|c]=64512,r[c]=13,r[256|c]=13)}let a=new Uint32Array(2048),s=new Uint32Array(64),o=new Uint32Array(64);for(let c=1;c<1024;++c){let l=c<<13,h=0;for(;!(8388608&l);)l<<=1,h-=8388608;l&=-8388609,h+=947912704,a[c]=l|h}for(let c=1024;c<2048;++c)a[c]=939524096+(c-1024<<13);for(let c=1;c<31;++c)s[c]=c<<23;s[31]=1199570944,s[32]=2147483648;for(let c=33;c<63;++c)s[c]=2147483648+(c-32<<23);s[63]=3347054592;for(let c=1;c<64;++c)c!==32&&(o[c]=1024);return{floatView:e,uint32View:t,baseTable:n,shiftTable:r,mantissaTable:a,exponentTable:s,offsetTable:o}}var Ot=new M,Vs=new oe,Zm=0,Nt=class{constructor(e,t,n=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Zm++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=wc,this.updateRanges=[],this.gpuType=Xn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,a=this.itemSize;r<a;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Vs.fromBufferAttribute(this,t),Vs.applyMatrix3(e),this.setXY(t,Vs.x,Vs.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyMatrix3(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyMatrix4(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.applyNormalMatrix(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Ot.fromBufferAttribute(this,t),Ot.transformDirection(e),this.setXYZ(t,Ot.x,Ot.y,Ot.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Vi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=sn(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Vi(t,this.array)),t}setX(e,t){return this.normalized&&(t=sn(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Vi(t,this.array)),t}setY(e,t){return this.normalized&&(t=sn(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Vi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=sn(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Vi(t,this.array)),t}setW(e,t){return this.normalized&&(t=sn(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=sn(t,this.array),n=sn(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=sn(t,this.array),n=sn(n,this.array),r=sn(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,a){return e*=this.itemSize,this.normalized&&(t=sn(t,this.array),n=sn(n,this.array),r=sn(r,this.array),a=sn(a,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=a,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==wc&&(e.usage=this.usage),e}};var Wa=class extends Nt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Xa=class extends Nt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var Le=class extends Nt{constructor(e,t,n){super(new Float32Array(e),t,n)}},Jm=0,Rn=new Ke,dc=new At,Fi=new M,vn=new In,La=new In,Xt=new M,tt=class i extends tr{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Jm++}),this.uuid=pi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Sh(e)?Xa:Wa)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let a=new qe().getNormalMatrix(e);n.applyNormalMatrix(a),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return Rn.makeRotationFromQuaternion(e),this.applyMatrix4(Rn),this}rotateX(e){return Rn.makeRotationX(e),this.applyMatrix4(Rn),this}rotateY(e){return Rn.makeRotationY(e),this.applyMatrix4(Rn),this}rotateZ(e){return Rn.makeRotationZ(e),this.applyMatrix4(Rn),this}translate(e,t,n){return Rn.makeTranslation(e,t,n),this.applyMatrix4(Rn),this}scale(e,t,n){return Rn.makeScale(e,t,n),this.applyMatrix4(Rn),this}lookAt(e){return dc.lookAt(e),dc.updateMatrix(),this.applyMatrix4(dc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Fi).negate(),this.translate(Fi.x,Fi.y,Fi.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let r=0,a=e.length;r<a;r++){let s=e[r];n.push(s.x,s.y,s.z||0)}this.setAttribute("position",new Le(n,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let a=e[r];t.setXYZ(r,a.x,a.y,a.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new In);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),void this.boundingBox.set(new M(-1/0,-1/0,-1/0),new M(1/0,1/0,1/0));if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){let a=t[n];vn.setFromBufferAttribute(a),this.morphTargetsRelative?(Xt.addVectors(this.boundingBox.min,vn.min),this.boundingBox.expandByPoint(Xt),Xt.addVectors(this.boundingBox.max,vn.max),this.boundingBox.expandByPoint(Xt)):(this.boundingBox.expandByPoint(vn.min),this.boundingBox.expandByPoint(vn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ln);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute)return console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),void this.boundingSphere.set(new M,1/0);if(e){let n=this.boundingSphere.center;if(vn.setFromBufferAttribute(e),t)for(let a=0,s=t.length;a<s;a++){let o=t[a];La.setFromBufferAttribute(o),this.morphTargetsRelative?(Xt.addVectors(vn.min,La.min),vn.expandByPoint(Xt),Xt.addVectors(vn.max,La.max),vn.expandByPoint(Xt)):(vn.expandByPoint(La.min),vn.expandByPoint(La.max))}vn.getCenter(n);let r=0;for(let a=0,s=e.count;a<s;a++)Xt.fromBufferAttribute(e,a),r=Math.max(r,n.distanceToSquared(Xt));if(t)for(let a=0,s=t.length;a<s;a++){let o=t[a],c=this.morphTargetsRelative;for(let l=0,h=o.count;l<h;l++)Xt.fromBufferAttribute(o,l),c&&(Fi.fromBufferAttribute(e,l),Xt.add(Fi)),r=Math.max(r,n.distanceToSquared(Xt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0)return void console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");let n=t.position,r=t.normal,a=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Nt(new Float32Array(4*n.count),4));let s=this.getAttribute("tangent"),o=[],c=[];for(let G=0;G<n.count;G++)o[G]=new M,c[G]=new M;let l=new M,h=new M,u=new M,d=new oe,p=new oe,f=new oe,_=new M,m=new M;function g(G,F,j){l.fromBufferAttribute(n,G),h.fromBufferAttribute(n,F),u.fromBufferAttribute(n,j),d.fromBufferAttribute(a,G),p.fromBufferAttribute(a,F),f.fromBufferAttribute(a,j),h.sub(l),u.sub(l),p.sub(d),f.sub(d);let K=1/(p.x*f.y-f.x*p.y);isFinite(K)&&(_.copy(h).multiplyScalar(f.y).addScaledVector(u,-p.y).multiplyScalar(K),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-f.x).multiplyScalar(K),o[G].add(_),o[F].add(_),o[j].add(_),c[G].add(m),c[F].add(m),c[j].add(m))}let y=this.groups;y.length===0&&(y=[{start:0,count:e.count}]);for(let G=0,F=y.length;G<F;++G){let j=y[G],K=j.start;for(let z=K,Z=K+j.count;z<Z;z+=3)g(e.getX(z+0),e.getX(z+1),e.getX(z+2))}let x=new M,b=new M,L=new M,I=new M;function B(G){L.fromBufferAttribute(r,G),I.copy(L);let F=o[G];x.copy(F),x.sub(L.multiplyScalar(L.dot(F))).normalize(),b.crossVectors(I,F);let j=b.dot(c[G])<0?-1:1;s.setXYZW(G,x.x,x.y,x.z,j)}for(let G=0,F=y.length;G<F;++G){let j=y[G],K=j.start;for(let z=K,Z=K+j.count;z<Z;z+=3)B(e.getX(z+0)),B(e.getX(z+1)),B(e.getX(z+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Nt(new Float32Array(3*t.count),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);let r=new M,a=new M,s=new M,o=new M,c=new M,l=new M,h=new M,u=new M;if(e)for(let d=0,p=e.count;d<p;d+=3){let f=e.getX(d+0),_=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),a.fromBufferAttribute(t,_),s.fromBufferAttribute(t,m),h.subVectors(s,a),u.subVectors(r,a),h.cross(u),o.fromBufferAttribute(n,f),c.fromBufferAttribute(n,_),l.fromBufferAttribute(n,m),o.add(h),c.add(h),l.add(h),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(_,c.x,c.y,c.z),n.setXYZ(m,l.x,l.y,l.z)}else for(let d=0,p=t.count;d<p;d+=3)r.fromBufferAttribute(t,d+0),a.fromBufferAttribute(t,d+1),s.fromBufferAttribute(t,d+2),h.subVectors(s,a),u.subVectors(r,a),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Xt.fromBufferAttribute(e,t),Xt.normalize(),e.setXYZ(t,Xt.x,Xt.y,Xt.z)}toNonIndexed(){function e(o,c){let l=o.array,h=o.itemSize,u=o.normalized,d=new l.constructor(c.length*h),p=0,f=0;for(let _=0,m=c.length;_<m;_++){p=o.isInterleavedBufferAttribute?c[_]*o.data.stride+o.offset:c[_]*h;for(let g=0;g<h;g++)d[f++]=l[p++]}return new Nt(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,r=this.attributes;for(let o in r){let c=e(r[o],n);t.setAttribute(o,c)}let a=this.morphAttributes;for(let o in a){let c=[],l=a[o];for(let h=0,u=l.length;h<u;h++){let d=e(l[h],n);c.push(d)}t.morphAttributes[o]=c}t.morphTargetsRelative=this.morphTargetsRelative;let s=this.groups;for(let o=0,c=s.length;o<c;o++){let l=s[o];t.addGroup(l.start,l.count,l.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let c=this.parameters;for(let l in c)c[l]!==void 0&&(e[l]=c[l]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let c in n){let l=n[c];e.data.attributes[c]=l.toJSON(e.data)}let r={},a=!1;for(let c in this.morphAttributes){let l=this.morphAttributes[c],h=[];for(let u=0,d=l.length;u<d;u++){let p=l[u];h.push(p.toJSON(e.data))}h.length>0&&(r[c]=h,a=!0)}a&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let s=this.groups;s.length>0&&(e.data.groups=JSON.parse(JSON.stringify(s)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let l in r){let h=r[l];this.setAttribute(l,h.clone(t))}let a=e.morphAttributes;for(let l in a){let h=[],u=a[l];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[l]=h}this.morphTargetsRelative=e.morphTargetsRelative;let s=e.groups;for(let l=0,h=s.length;l<h;l++){let u=s[l];this.addGroup(u.start,u.count,u.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let c=e.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}},Pu=new Ke,$r=new rr,zs=new Ln,Du=new M,Gs=new M,Ws=new M,Xs=new M,pc=new M,js=new M,Nu=new M,qs=new M,Bt=class extends At{constructor(e=new tt,t=new xn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,a=n.morphAttributes.position,s=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(a&&o){js.set(0,0,0);for(let c=0,l=a.length;c<l;c++){let h=o[c],u=a[c];h!==0&&(pc.fromBufferAttribute(u,e),s?js.addScaledVector(pc,h):js.addScaledVector(pc.sub(t),h))}t.add(js)}return t}raycast(e,t){let n=this.geometry,r=this.material,a=this.matrixWorld;if(r!==void 0){if(n.boundingSphere===null&&n.computeBoundingSphere(),zs.copy(n.boundingSphere),zs.applyMatrix4(a),$r.copy(e.ray).recast(e.near),zs.containsPoint($r.origin)===!1&&($r.intersectSphere(zs,Du)===null||$r.origin.distanceToSquared(Du)>(e.far-e.near)**2))return;Pu.copy(a).invert(),$r.copy(e.ray).applyMatrix4(Pu),n.boundingBox!==null&&$r.intersectsBox(n.boundingBox)===!1||this._computeIntersections(e,t,$r)}}_computeIntersections(e,t,n){let r,a=this.geometry,s=this.material,o=a.index,c=a.attributes.position,l=a.attributes.uv,h=a.attributes.uv1,u=a.attributes.normal,d=a.groups,p=a.drawRange;if(o!==null)if(Array.isArray(s))for(let f=0,_=d.length;f<_;f++){let m=d[f],g=s[m.materialIndex];for(let y=Math.max(m.start,p.start),x=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));y<x;y+=3)r=Ys(this,g,e,n,l,h,u,o.getX(y),o.getX(y+1),o.getX(y+2)),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=m.materialIndex,t.push(r))}else for(let f=Math.max(0,p.start),_=Math.min(o.count,p.start+p.count);f<_;f+=3)r=Ys(this,s,e,n,l,h,u,o.getX(f),o.getX(f+1),o.getX(f+2)),r&&(r.faceIndex=Math.floor(f/3),t.push(r));else if(c!==void 0)if(Array.isArray(s))for(let f=0,_=d.length;f<_;f++){let m=d[f],g=s[m.materialIndex];for(let y=Math.max(m.start,p.start),x=Math.min(c.count,Math.min(m.start+m.count,p.start+p.count));y<x;y+=3)r=Ys(this,g,e,n,l,h,u,y,y+1,y+2),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=m.materialIndex,t.push(r))}else for(let f=Math.max(0,p.start),_=Math.min(c.count,p.start+p.count);f<_;f+=3)r=Ys(this,s,e,n,l,h,u,f,f+1,f+2),r&&(r.faceIndex=Math.floor(f/3),t.push(r))}};function Ys(i,e,t,n,r,a,s,o,c,l){i.getVertexPosition(o,Gs),i.getVertexPosition(c,Ws),i.getVertexPosition(l,Xs);let h=(function(u,d,p,f,_,m,g,y){let x;if(x=d.side===1?f.intersectTriangle(g,m,_,!0,y):f.intersectTriangle(_,m,g,d.side===0,y),x===null)return null;qs.copy(y),qs.applyMatrix4(u.matrixWorld);let b=p.ray.origin.distanceTo(qs);return b<p.near||b>p.far?null:{distance:b,point:qs.clone(),object:u}})(i,e,t,n,Gs,Ws,Xs,Nu);if(h){let u=new M;fr.getBarycoord(Nu,Gs,Ws,Xs,u),r&&(h.uv=fr.getInterpolatedAttribute(r,o,c,l,u,new oe)),a&&(h.uv1=fr.getInterpolatedAttribute(a,o,c,l,u,new oe)),s&&(h.normal=fr.getInterpolatedAttribute(s,o,c,l,u,new M),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a:o,b:c,c:l,normal:new M,materialIndex:0};fr.getNormal(Gs,Ws,Xs,d.normal),h.face=d,h.barycoord=u}return h}var En=class i extends tt{constructor(e=1,t=1,n=1,r=1,a=1,s=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:a,depthSegments:s};let o=this;r=Math.floor(r),a=Math.floor(a),s=Math.floor(s);let c=[],l=[],h=[],u=[],d=0,p=0;function f(_,m,g,y,x,b,L,I,B,G,F){let j=b/B,K=L/G,z=b/2,Z=L/2,X=I/2,Q=B+1,ie=G+1,pe=0,ae=0,Se=new M;for(let Pe=0;Pe<ie;Pe++){let ve=Pe*K-Z;for(let Re=0;Re<Q;Re++){let ue=Re*j-z;Se[_]=ue*y,Se[m]=ve*x,Se[g]=X,l.push(Se.x,Se.y,Se.z),Se[_]=0,Se[m]=0,Se[g]=I>0?1:-1,h.push(Se.x,Se.y,Se.z),u.push(Re/B),u.push(1-Pe/G),pe+=1}}for(let Pe=0;Pe<G;Pe++)for(let ve=0;ve<B;ve++){let Re=d+ve+Q*Pe,ue=d+ve+Q*(Pe+1),ge=d+(ve+1)+Q*(Pe+1),me=d+(ve+1)+Q*Pe;c.push(Re,ue,me),c.push(ue,ge,me),ae+=6}o.addGroup(p,ae,F),p+=ae,d+=pe}f("z","y","x",-1,-1,n,t,e,s,a,0),f("z","y","x",1,-1,n,t,-e,s,a,1),f("x","z","y",1,1,e,n,t,r,s,2),f("x","z","y",1,-1,e,n,-t,r,s,3),f("x","y","z",1,-1,e,t,n,r,a,4),f("x","y","z",-1,-1,e,t,-n,r,a,5),this.setIndex(c),this.setAttribute("position",new Le(l,3)),this.setAttribute("normal",new Le(h,3)),this.setAttribute("uv",new Le(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};function mi(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let r=i[t][n];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone():Array.isArray(r)?e[t][n]=r.slice():e[t][n]=r}}return e}function en(i){let e={};for(let t=0;t<i.length;t++){let n=mi(i[t]);for(let r in n)e[r]=n[r]}return e}function Th(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:st.workingColorSpace}var $d={clone:mi,merge:en},Wn=class extends Gn{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,this.fragmentShader=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=mi(e.uniforms),this.uniformsGroups=(function(t){let n=[];for(let r=0;r<t.length;r++)n.push(t[r].clone());return n})(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},Ki=class extends At{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ke,this.projectionMatrix=new Ke,this.projectionMatrixInverse=new Ke,this.coordinateSystem=yr,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}},Cr=new M,Uu=new oe,Ou=new oe,Qt=class extends Ki{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=2*Xi*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(.5*zi*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return 2*Xi*Math.atan(Math.tan(.5*zi*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Cr.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Cr.x,Cr.y).multiplyScalar(-e/Cr.z),Cr.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Cr.x,Cr.y).multiplyScalar(-e/Cr.z)}getViewSize(e,t){return this.getViewBounds(e,Uu,Ou),t.subVectors(Ou,Uu)}setViewOffset(e,t,n,r,a,s){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=a,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(.5*zi*this.fov)/this.zoom,n=2*t,r=this.aspect*n,a=-.5*r,s=this.view;if(this.view!==null&&this.view.enabled){let c=s.fullWidth,l=s.fullHeight;a+=s.offsetX*r/c,t-=s.offsetY*n/l,r*=s.width/c,n*=s.height/l}let o=this.filmOffset;o!==0&&(a+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},ki=-90,yo=class extends At{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Qt(ki,1,e,t);r.layers=this.layers,this.add(r);let a=new Qt(ki,1,e,t);a.layers=this.layers,this.add(a);let s=new Qt(ki,1,e,t);s.layers=this.layers,this.add(s);let o=new Qt(ki,1,e,t);o.layers=this.layers,this.add(o);let c=new Qt(ki,1,e,t);c.layers=this.layers,this.add(c);let l=new Qt(ki,1,e,t);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,a,s,o,c]=t;for(let l of t)this.remove(l);if(e===yr)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),s.up.set(0,0,1),s.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else{if(e!==Va)throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),s.up.set(0,0,-1),s.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1)}for(let l of t)this.add(l),l.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[a,s,o,c,l,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),f=e.xr.enabled;e.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,e.setRenderTarget(n,0,r),e.render(t,a),e.setRenderTarget(n,1,r),e.render(t,s),e.setRenderTarget(n,2,r),e.render(t,o),e.setRenderTarget(n,3,r),e.render(t,c),e.setRenderTarget(n,4,r),e.render(t,l),n.texture.generateMipmaps=_,e.setRenderTarget(n,5,r),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=f,n.texture.needsPMREMUpdate=!0}},ja=class extends un{constructor(e=[],t=301,n,r,a,s,o,c,l,h){super(e,t,n,r,a,s,o,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},vo=class extends nr{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new ja(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new En(5,5,5),a=new Wn({name:"CubemapFromEquirect",uniforms:mi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});a.uniforms.tEquirect.value=t;let s=new Bt(r,a),o=t.minFilter;return t.minFilter===hi&&(t.minFilter=er),new yo(1,10,this).update(e,s),t.minFilter=o,s.geometry.dispose(),s.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let a=e.getRenderTarget();for(let s=0;s<6;s++)e.setRenderTarget(this,s),e.clear(t,n,r);e.setRenderTarget(a)}},Dt=class extends At{constructor(){super(),this.isGroup=!0,this.type="Group"}},$m={type:"move"},Zi=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Dt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Dt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new M,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new M),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Dt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new M,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new M),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,a=null,s=null,o=this._targetRay,c=this._grip,l=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(l&&e.hand){s=!0;for(let _ of e.hand.values()){let m=t.getJointPose(_,n),g=this._getHandJoint(l,_);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=l.joints["index-finger-tip"],u=l.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,f=.005;l.inputState.pinching&&d>p+f?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!l.inputState.pinching&&d<=p-f&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else c!==null&&e.gripSpace&&(a=t.getPose(e.gripSpace,n),a!==null&&(c.matrix.fromArray(a.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,a.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(a.linearVelocity)):c.hasLinearVelocity=!1,a.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(a.angularVelocity)):c.hasAngularVelocity=!1));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&a!==null&&(r=a),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent($m)))}return o!==null&&(o.visible=r!==null),c!==null&&(c.visible=a!==null),l!==null&&(l.visible=s!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Dt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},qa=class i{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new ke(e),this.density=t}clone(){return new i(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var Ya=class extends At{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Pn,this.environmentIntensity=1,this.environmentRotation=new Pn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}};var x0=new M;var E0=new M,M0=new M,b0=new M,S0=new oe,T0=new oe,w0=new Ke,A0=new M,R0=new M,C0=new M,I0=new oe,L0=new oe,P0=new oe;var D0=new M,N0=new M;var U0=new M,O0=new Rt,B0=new Rt,F0=new M,k0=new Ke,H0=new M,V0=new Ln,z0=new Ke,G0=new rr;var _o=class extends un{constructor(e=null,t=1,n=1,r,a,s,o,c,l=1003,h=1003,u,d){super(null,s,o,c,l,h,r,a,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},W0=new Ke,X0=new Ke;var Ka=class extends Nt{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Hi=new Ke,Bu=new Ke,Ks=[],Fu=new In,Qm=new Ke,Pa=new Bt,Da=new Ln,ir=class extends Bt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ka(new Float32Array(16*n),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<n;r++)this.setMatrixAt(r,Qm)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new In),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Hi),Fu.copy(e.boundingBox).applyMatrix4(Hi),this.boundingBox.union(Fu)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Ln),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Hi),Da.copy(e.boundingSphere).applyMatrix4(Hi),this.boundingSphere.union(Da)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,3*e)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,16*e)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,a=e*(n.length+1)+1;for(let s=0;s<n.length;s++)n[s]=r[a+s]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Pa.geometry=this.geometry,Pa.material=this.material,Pa.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Da.copy(this.boundingSphere),Da.applyMatrix4(n),e.ray.intersectsSphere(Da)!==!1))for(let a=0;a<r;a++){this.getMatrixAt(a,Hi),Bu.multiplyMatrices(n,Hi),Pa.matrixWorld=Bu,Pa.raycast(e,Ks);for(let s=0,o=Ks.length;s<o;s++){let c=Ks[s];c.instanceId=a,c.object=this,t.push(c)}Ks.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Ka(new Float32Array(3*this.instanceMatrix.count).fill(1),3)),t.toArray(this.instanceColor.array,3*e)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,16*e)}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new _o(new Float32Array(r*this.count),r,this.count,ul,Xn));let a=this.morphTexture.source.data.data,s=0;for(let l=0;l<n.length;l++)s+=n[l];let o=this.geometry.morphTargetsRelative?1:1-s,c=r*e;a[c]=o,a.set(n,c+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},mc=new M,ef=new M,tf=new qe,Cn=class{constructor(e=new M(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=mc.subVectors(n,t).cross(ef.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){let n=e.delta(mc),r=this.normal.dot(n);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/r;return a<0||a>1?null:t.copy(e.start).addScaledVector(n,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||tf.getNormalMatrix(e),r=this.coplanarPoint(mc).applyMatrix4(e),a=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(a),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},Qr=new Ln,nf=new oe(.5,.5),Zs=new M,Pr=class{constructor(e=new Cn,t=new Cn,n=new Cn,r=new Cn,a=new Cn,s=new Cn){this.planes=[e,t,n,r,a,s]}set(e,t,n,r,a,s){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(a),o[5].copy(s),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=2e3,n=!1){let r=this.planes,a=e.elements,s=a[0],o=a[1],c=a[2],l=a[3],h=a[4],u=a[5],d=a[6],p=a[7],f=a[8],_=a[9],m=a[10],g=a[11],y=a[12],x=a[13],b=a[14],L=a[15];if(r[0].setComponents(l-s,p-h,g-f,L-y).normalize(),r[1].setComponents(l+s,p+h,g+f,L+y).normalize(),r[2].setComponents(l+o,p+u,g+_,L+x).normalize(),r[3].setComponents(l-o,p-u,g-_,L-x).normalize(),n)r[4].setComponents(c,d,m,b).normalize(),r[5].setComponents(l-c,p-d,g-m,L-b).normalize();else if(r[4].setComponents(l-c,p-d,g-m,L-b).normalize(),t===yr)r[5].setComponents(l+c,p+d,g+m,L+b).normalize();else{if(t!==Va)throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);r[5].setComponents(c,d,m,b).normalize()}return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Qr.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Qr.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Qr)}intersectsSprite(e){Qr.center.set(0,0,0);let t=nf.distanceTo(e.center);return Qr.radius=.7071067811865476+t,Qr.applyMatrix4(e.matrixWorld),this.intersectsSphere(Qr)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let a=0;a<6;a++)if(t[a].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(Zs.x=r.normal.x>0?e.max.x:e.min.x,Zs.y=r.normal.y>0?e.max.y:e.min.y,Zs.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Zs)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},Zn=new Ke,Jn=new Pr,xo=class i{constructor(){this.coordinateSystem=yr}intersectsObject(e,t){if(!t.isArrayCamera||t.cameras.length===0)return!1;for(let n=0;n<t.cameras.length;n++){let r=t.cameras[n];if(Zn.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),Jn.setFromProjectionMatrix(Zn,r.coordinateSystem,r.reversedDepth),Jn.intersectsObject(e))return!0}return!1}intersectsSprite(e,t){if(!t||!t.cameras||t.cameras.length===0)return!1;for(let n=0;n<t.cameras.length;n++){let r=t.cameras[n];if(Zn.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),Jn.setFromProjectionMatrix(Zn,r.coordinateSystem,r.reversedDepth),Jn.intersectsSprite(e))return!0}return!1}intersectsSphere(e,t){if(!t||!t.cameras||t.cameras.length===0)return!1;for(let n=0;n<t.cameras.length;n++){let r=t.cameras[n];if(Zn.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),Jn.setFromProjectionMatrix(Zn,r.coordinateSystem,r.reversedDepth),Jn.intersectsSphere(e))return!0}return!1}intersectsBox(e,t){if(!t||!t.cameras||t.cameras.length===0)return!1;for(let n=0;n<t.cameras.length;n++){let r=t.cameras[n];if(Zn.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),Jn.setFromProjectionMatrix(Zn,r.coordinateSystem,r.reversedDepth),Jn.intersectsBox(e))return!0}return!1}containsPoint(e,t){if(!t||!t.cameras||t.cameras.length===0)return!1;for(let n=0;n<t.cameras.length;n++){let r=t.cameras[n];if(Zn.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),Jn.setFromProjectionMatrix(Zn,r.coordinateSystem,r.reversedDepth),Jn.containsPoint(e))return!0}return!1}clone(){return new i}};var Rc=class{constructor(){this.index=0,this.pool=[],this.list=[]}push(e,t,n,r){let a=this.pool,s=this.list;this.index>=a.length&&a.push({start:-1,count:-1,z:-1,index:-1});let o=a[this.index];s.push(o),this.index++,o.start=e,o.count=t,o.z=n,o.index=r}reset(){this.list.length=0,this.index=0}},j0=new Ke,q0=new ke(1,1,1),Y0=new Pr,K0=new xo,Z0=new In,J0=new Ln,$0=new M,Q0=new M,ey=new M,ty=new Rc,ny=new Bt;var Yt=class extends Gn{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ke(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},Eo=new M,Mo=new M,ku=new Ke,Na=new rr,Js=new Ln,fc=new M,Hu=new M,Dn=class extends At{constructor(e=new tt,t=new Yt){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let r=1,a=t.count;r<a;r++)Eo.fromBufferAttribute(t,r-1),Mo.fromBufferAttribute(t,r),n[r]=n[r-1],n[r]+=Eo.distanceTo(Mo);e.setAttribute("lineDistance",new Le(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,a=e.params.Line.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Js.copy(n.boundingSphere),Js.applyMatrix4(r),Js.radius+=a,e.ray.intersectsSphere(Js)===!1)return;ku.copy(r).invert(),Na.copy(e.ray).applyMatrix4(ku);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),c=o*o,l=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){let d=Math.max(0,s.start),p=Math.min(h.count,s.start+s.count);for(let f=d,_=p-1;f<_;f+=l){let m=h.getX(f),g=h.getX(f+1),y=$s(this,e,Na,c,m,g,f);y&&t.push(y)}if(this.isLineLoop){let f=h.getX(p-1),_=h.getX(d),m=$s(this,e,Na,c,f,_,p-1);m&&t.push(m)}}else{let d=Math.max(0,s.start),p=Math.min(u.count,s.start+s.count);for(let f=d,_=p-1;f<_;f+=l){let m=$s(this,e,Na,c,f,f+1,f);m&&t.push(m)}if(this.isLineLoop){let f=$s(this,e,Na,c,p-1,d,p-1);f&&t.push(f)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}};function $s(i,e,t,n,r,a,s){let o=i.geometry.attributes.position;if(Eo.fromBufferAttribute(o,r),Mo.fromBufferAttribute(o,a),t.distanceSqToSegment(Eo,Mo,fc,Hu)>n)return;fc.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(fc);return c<e.near||c>e.far?void 0:{distance:c,point:Hu.clone().applyMatrix4(i.matrixWorld),index:s,face:null,faceIndex:null,barycoord:null,object:i}}var Vu=new M,zu=new M,ar=class extends Dn{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let r=0,a=t.count;r<a;r+=2)Vu.fromBufferAttribute(t,r),zu.fromBufferAttribute(t,r+1),n[r]=r===0?0:n[r-1],n[r+1]=n[r]+Vu.distanceTo(zu);e.setAttribute("lineDistance",new Le(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Dr=class extends Gn{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ke(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Gu=new Ke,Cc=new rr,Qs=new Ln,eo=new M,ni=class extends At{constructor(e=new tt,t=new Dr){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,a=e.params.Points.threshold,s=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Qs.copy(n.boundingSphere),Qs.applyMatrix4(r),Qs.radius+=a,e.ray.intersectsSphere(Qs)===!1)return;Gu.copy(r).invert(),Cc.copy(e.ray).applyMatrix4(Gu);let o=a/((this.scale.x+this.scale.y+this.scale.z)/3),c=o*o,l=n.index,h=n.attributes.position;if(l!==null)for(let u=Math.max(0,s.start),d=Math.min(l.count,s.start+s.count);u<d;u++){let p=l.getX(u);eo.fromBufferAttribute(h,p),Wu(eo,p,c,r,e,t,this)}else for(let u=Math.max(0,s.start),d=Math.min(h.count,s.start+s.count);u<d;u++)eo.fromBufferAttribute(h,u),Wu(eo,u,c,r,e,t,this)}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=n.length;r<a;r++){let s=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[s]=r}}}}};function Wu(i,e,t,n,r,a,s){let o=Cc.distanceSqToPoint(i);if(o<t){let c=new M;Cc.closestPointToPoint(i,c),c.applyMatrix4(n);let l=r.ray.origin.distanceTo(c);if(l<r.near||l>r.far)return;a.push({distance:l,distanceToRay:Math.sqrt(o),point:c,index:e,face:null,faceIndex:null,barycoord:null,object:s})}}var Za=class extends un{constructor(e,t,n=1014,r,a,s,o=1003,c=1003,l,h=1026,u=1){if(h!==Es&&h!==1027)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");super({width:e,height:t,depth:u},r,a,s,o,c,h,n,l),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new qi(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},Ja=class extends un{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},bo=class i extends tt{constructor(e=1,t=1,n=4,r=8,a=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:n,radialSegments:r,heightSegments:a},t=Math.max(0,t),n=Math.max(1,Math.floor(n)),r=Math.max(3,Math.floor(r)),a=Math.max(1,Math.floor(a));let s=[],o=[],c=[],l=[],h=t/2,u=Math.PI/2*e,d=t,p=2*u+d,f=2*n+a,_=r+1,m=new M,g=new M;for(let y=0;y<=f;y++){let x=0,b=0,L=0,I=0;if(y<=n){let F=y/n,j=F*Math.PI/2;b=-h-e*Math.cos(j),L=e*Math.sin(j),I=-e*Math.cos(j),x=F*u}else if(y<=n+a){let F=(y-n)/a;b=F*t-h,L=e,I=0,x=u+F*d}else{let F=(y-n-a)/n,j=F*Math.PI/2;b=h+e*Math.sin(j),L=e*Math.cos(j),I=e*Math.sin(j),x=u+d+F*u}let B=Math.max(0,Math.min(1,x/p)),G=0;y===0?G=.5/r:y===f&&(G=-.5/r);for(let F=0;F<=r;F++){let j=F/r,K=j*Math.PI*2,z=Math.sin(K),Z=Math.cos(K);g.x=-L*Z,g.y=b,g.z=L*z,o.push(g.x,g.y,g.z),m.set(-L*Z,I,L*z),m.normalize(),c.push(m.x,m.y,m.z),l.push(j+G,B)}if(y>0){let F=(y-1)*_;for(let j=0;j<r;j++){let K=F+j,z=F+j+1,Z=y*_+j,X=y*_+j+1;s.push(K,z,Z),s.push(z,X,Z)}}}this.setIndex(s),this.setAttribute("position",new Le(o,3)),this.setAttribute("normal",new Le(c,3)),this.setAttribute("uv",new Le(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}},So=class i extends tt{constructor(e=1,t=32,n=0,r=2*Math.PI){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let a=[],s=[],o=[],c=[],l=new M,h=new oe;s.push(0,0,0),o.push(0,0,1),c.push(.5,.5);for(let u=0,d=3;u<=t;u++,d+=3){let p=n+u/t*r;l.x=e*Math.cos(p),l.y=e*Math.sin(p),s.push(l.x,l.y,l.z),o.push(0,0,1),h.x=(s[d]/e+1)/2,h.y=(s[d+1]/e+1)/2,c.push(h.x,h.y)}for(let u=1;u<=t;u++)a.push(u,u+1,0);this.setIndex(a),this.setAttribute("position",new Le(s,3)),this.setAttribute("normal",new Le(o,3)),this.setAttribute("uv",new Le(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.segments,e.thetaStart,e.thetaLength)}},$a=class i extends tt{constructor(e=1,t=1,n=1,r=32,a=1,s=!1,o=0,c=2*Math.PI){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:a,openEnded:s,thetaStart:o,thetaLength:c};let l=this;r=Math.floor(r),a=Math.floor(a);let h=[],u=[],d=[],p=[],f=0,_=[],m=n/2,g=0;function y(x){let b=f,L=new oe,I=new M,B=0,G=x===!0?e:t,F=x===!0?1:-1;for(let K=1;K<=r;K++)u.push(0,m*F,0),d.push(0,F,0),p.push(.5,.5),f++;let j=f;for(let K=0;K<=r;K++){let z=K/r*c+o,Z=Math.cos(z),X=Math.sin(z);I.x=G*X,I.y=m*F,I.z=G*Z,u.push(I.x,I.y,I.z),d.push(0,F,0),L.x=.5*Z+.5,L.y=.5*X*F+.5,p.push(L.x,L.y),f++}for(let K=0;K<r;K++){let z=b+K,Z=j+K;x===!0?h.push(Z,Z+1,z):h.push(Z+1,Z,z),B+=3}l.addGroup(g,B,x===!0?1:2),g+=B}(function(){let x=new M,b=new M,L=0,I=(t-e)/n;for(let B=0;B<=a;B++){let G=[],F=B/a,j=F*(t-e)+e;for(let K=0;K<=r;K++){let z=K/r,Z=z*c+o,X=Math.sin(Z),Q=Math.cos(Z);b.x=j*X,b.y=-F*n+m,b.z=j*Q,u.push(b.x,b.y,b.z),x.set(X,I,Q).normalize(),d.push(x.x,x.y,x.z),p.push(z,1-F),G.push(f++)}_.push(G)}for(let B=0;B<r;B++)for(let G=0;G<a;G++){let F=_[G][B],j=_[G+1][B],K=_[G+1][B+1],z=_[G][B+1];(e>0||G!==0)&&(h.push(F,j,z),L+=3),(t>0||G!==a-1)&&(h.push(j,K,z),L+=3)}l.addGroup(g,L,0),g+=L})(),s===!1&&(e>0&&y(!0),t>0&&y(!1)),this.setIndex(h),this.setAttribute("position",new Le(u,3)),this.setAttribute("normal",new Le(d,3)),this.setAttribute("uv",new Le(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Qa=class i extends $a{constructor(e=1,t=1,n=32,r=1,a=!1,s=0,o=2*Math.PI){super(0,e,t,n,r,a,s,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:s,thetaLength:o}}static fromJSON(e){return new i(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}},Nr=class i extends tt{constructor(e=[],t=[],n=1,r=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:r};let a=[],s=[];function o(p,f,_,m){let g=m+1,y=[];for(let x=0;x<=g;x++){y[x]=[];let b=p.clone().lerp(_,x/g),L=f.clone().lerp(_,x/g),I=g-x;for(let B=0;B<=I;B++)y[x][B]=B===0&&x===g?b:b.clone().lerp(L,B/I)}for(let x=0;x<g;x++)for(let b=0;b<2*(g-x)-1;b++){let L=Math.floor(b/2);b%2==0?(c(y[x][L+1]),c(y[x+1][L]),c(y[x][L])):(c(y[x][L+1]),c(y[x+1][L+1]),c(y[x+1][L]))}}function c(p){a.push(p.x,p.y,p.z)}function l(p,f){let _=3*p;f.x=e[_+0],f.y=e[_+1],f.z=e[_+2]}function h(p,f,_,m){m<0&&p.x===1&&(s[f]=p.x-1),_.x===0&&_.z===0&&(s[f]=m/2/Math.PI+.5)}function u(p){return Math.atan2(p.z,-p.x)}function d(p){return Math.atan2(-p.y,Math.sqrt(p.x*p.x+p.z*p.z))}(function(p){let f=new M,_=new M,m=new M;for(let g=0;g<t.length;g+=3)l(t[g+0],f),l(t[g+1],_),l(t[g+2],m),o(f,_,m,p)})(r),(function(p){let f=new M;for(let _=0;_<a.length;_+=3)f.x=a[_+0],f.y=a[_+1],f.z=a[_+2],f.normalize().multiplyScalar(p),a[_+0]=f.x,a[_+1]=f.y,a[_+2]=f.z})(n),(function(){let p=new M;for(let f=0;f<a.length;f+=3){p.x=a[f+0],p.y=a[f+1],p.z=a[f+2];let _=u(p)/2/Math.PI+.5,m=d(p)/Math.PI+.5;s.push(_,1-m)}(function(){let f=new M,_=new M,m=new M,g=new M,y=new oe,x=new oe,b=new oe;for(let L=0,I=0;L<a.length;L+=9,I+=6){f.set(a[L+0],a[L+1],a[L+2]),_.set(a[L+3],a[L+4],a[L+5]),m.set(a[L+6],a[L+7],a[L+8]),y.set(s[I+0],s[I+1]),x.set(s[I+2],s[I+3]),b.set(s[I+4],s[I+5]),g.copy(f).add(_).add(m).divideScalar(3);let B=u(g);h(y,I+0,f,B),h(x,I+2,_,B),h(b,I+4,m,B)}})(),(function(){for(let f=0;f<s.length;f+=6){let _=s[f+0],m=s[f+2],g=s[f+4],y=Math.max(_,m,g),x=Math.min(_,m,g);y>.9&&x<.1&&(_<.2&&(s[f+0]+=1),m<.2&&(s[f+2]+=1),g<.2&&(s[f+4]+=1))}})()})(),this.setAttribute("position",new Le(a,3)),this.setAttribute("normal",new Le(a.slice(),3)),this.setAttribute("uv",new Le(s,2)),r===0?this.computeVertexNormals():this.normalizeNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.vertices,e.indices,e.radius,e.details)}},To=class i extends Nr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2,r=1/n;super([-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-r,-n,0,-r,n,0,r,-n,0,r,n,-r,-n,0,-r,n,0,r,-n,0,r,n,0,-n,0,-r,n,0,-r,-n,0,r,n,0,r],[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9],e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},to=new M,no=new M,gc=new M,ro=new fr,Ji=class extends tt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){let r=Math.pow(10,4),a=Math.cos(zi*t),s=e.getIndex(),o=e.getAttribute("position"),c=s?s.count:o.count,l=[0,0,0],h=["a","b","c"],u=new Array(3),d={},p=[];for(let f=0;f<c;f+=3){s?(l[0]=s.getX(f),l[1]=s.getX(f+1),l[2]=s.getX(f+2)):(l[0]=f,l[1]=f+1,l[2]=f+2);let{a:_,b:m,c:g}=ro;if(_.fromBufferAttribute(o,l[0]),m.fromBufferAttribute(o,l[1]),g.fromBufferAttribute(o,l[2]),ro.getNormal(gc),u[0]=`${Math.round(_.x*r)},${Math.round(_.y*r)},${Math.round(_.z*r)}`,u[1]=`${Math.round(m.x*r)},${Math.round(m.y*r)},${Math.round(m.z*r)}`,u[2]=`${Math.round(g.x*r)},${Math.round(g.y*r)},${Math.round(g.z*r)}`,u[0]!==u[1]&&u[1]!==u[2]&&u[2]!==u[0])for(let y=0;y<3;y++){let x=(y+1)%3,b=u[y],L=u[x],I=ro[h[y]],B=ro[h[x]],G=`${b}_${L}`,F=`${L}_${b}`;F in d&&d[F]?(gc.dot(d[F].normal)<=a&&(p.push(I.x,I.y,I.z),p.push(B.x,B.y,B.z)),d[F]=null):G in d||(d[G]={index0:l[y],index1:l[x],normal:gc.clone()})}}for(let f in d)if(d[f]){let{index0:_,index1:m}=d[f];to.fromBufferAttribute(o,_),no.fromBufferAttribute(o,m),p.push(to.x,to.y,to.z),p.push(no.x,no.y,no.z)}this.setAttribute("position",new Le(p,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}},Mn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){console.warn("THREE.Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),a=0;t.push(0);for(let s=1;s<=e;s++)n=this.getPoint(s/e),a+=n.distanceTo(r),t.push(a),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,a=n.length,s;s=t||e*n[a-1];let o,c=0,l=a-1;for(;c<=l;)if(r=Math.floor(c+(l-c)/2),o=n[r]-s,o<0)c=r+1;else{if(!(o>0)){l=r;break}l=r-1}if(r=l,n[r]===s)return r/(a-1);let h=n[r];return(r+(s-h)/(n[r+1]-h))/(a-1)}getTangent(e,t){let r=e-1e-4,a=e+1e-4;r<0&&(r=0),a>1&&(a=1);let s=this.getPoint(r),o=this.getPoint(a),c=t||(s.isVector2?new oe:new M);return c.copy(o).sub(s).normalize(),c}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new M,r=[],a=[],s=[],o=new M,c=new Ke;for(let p=0;p<=e;p++){let f=p/e;r[p]=this.getTangentAt(f,new M)}a[0]=new M,s[0]=new M;let l=Number.MAX_VALUE,h=Math.abs(r[0].x),u=Math.abs(r[0].y),d=Math.abs(r[0].z);h<=l&&(l=h,n.set(1,0,0)),u<=l&&(l=u,n.set(0,1,0)),d<=l&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),a[0].crossVectors(r[0],o),s[0].crossVectors(r[0],a[0]);for(let p=1;p<=e;p++){if(a[p]=a[p-1].clone(),s[p]=s[p-1].clone(),o.crossVectors(r[p-1],r[p]),o.length()>Number.EPSILON){o.normalize();let f=Math.acos(Ye(r[p-1].dot(r[p]),-1,1));a[p].applyMatrix4(c.makeRotationAxis(o,f))}s[p].crossVectors(r[p],a[p])}if(t===!0){let p=Math.acos(Ye(a[0].dot(a[e]),-1,1));p/=e,r[0].dot(o.crossVectors(a[0],a[e]))>0&&(p=-p);for(let f=1;f<=e;f++)a[f].applyMatrix4(c.makeRotationAxis(r[f],p*f)),s[f].crossVectors(r[f],a[f])}return{tangents:r,normals:a,binormals:s}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},$i=class extends Mn{constructor(e=0,t=0,n=1,r=1,a=0,s=2*Math.PI,o=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=a,this.aEndAngle=s,this.aClockwise=o,this.aRotation=c}getPoint(e,t=new oe){let n=t,r=2*Math.PI,a=this.aEndAngle-this.aStartAngle,s=Math.abs(a)<Number.EPSILON;for(;a<0;)a+=r;for(;a>r;)a-=r;a<Number.EPSILON&&(a=s?0:r),this.aClockwise!==!0||s||(a===r?a=-r:a-=r);let o=this.aStartAngle+e*a,c=this.aX+this.xRadius*Math.cos(o),l=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=c-this.aX,p=l-this.aY;c=d*h-p*u+this.aX,l=d*u+p*h+this.aY}return n.set(c,l)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},wo=class extends $i{constructor(e,t,n,r,a,s){super(e,t,n,n,r,a,s),this.isArcCurve=!0,this.type="ArcCurve"}};function wh(){let i=0,e=0,t=0,n=0;function r(a,s,o,c){i=a,e=o,t=-3*a+3*s-2*o-c,n=2*a-2*s+o+c}return{initCatmullRom:function(a,s,o,c,l){r(s,o,l*(o-a),l*(c-s))},initNonuniformCatmullRom:function(a,s,o,c,l,h,u){let d=(s-a)/l-(o-a)/(l+h)+(o-s)/h,p=(o-s)/h-(c-s)/(h+u)+(c-o)/u;d*=h,p*=h,r(s,o,d,p)},calc:function(a){let s=a*a;return i+e*a+t*s+n*(s*a)}}}var io=new M,yc=new wh,vc=new wh,_c=new wh,Ao=class extends Mn{constructor(e=[],t=!1,n="centripetal",r=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new M){let n=t,r=this.points,a=r.length,s=(a-(this.closed?0:1))*e,o,c,l=Math.floor(s),h=s-l;this.closed?l+=l>0?0:(Math.floor(Math.abs(l)/a)+1)*a:h===0&&l===a-1&&(l=a-2,h=1),this.closed||l>0?o=r[(l-1)%a]:(io.subVectors(r[0],r[1]).add(r[0]),o=io);let u=r[l%a],d=r[(l+1)%a];if(this.closed||l+2<a?c=r[(l+2)%a]:(io.subVectors(r[a-1],r[a-2]).add(r[a-1]),c=io),this.curveType==="centripetal"||this.curveType==="chordal"){let p=this.curveType==="chordal"?.5:.25,f=Math.pow(o.distanceToSquared(u),p),_=Math.pow(u.distanceToSquared(d),p),m=Math.pow(d.distanceToSquared(c),p);_<1e-4&&(_=1),f<1e-4&&(f=_),m<1e-4&&(m=_),yc.initNonuniformCatmullRom(o.x,u.x,d.x,c.x,f,_,m),vc.initNonuniformCatmullRom(o.y,u.y,d.y,c.y,f,_,m),_c.initNonuniformCatmullRom(o.z,u.z,d.z,c.z,f,_,m)}else this.curveType==="catmullrom"&&(yc.initCatmullRom(o.x,u.x,d.x,c.x,this.tension),vc.initCatmullRom(o.y,u.y,d.y,c.y,this.tension),_c.initCatmullRom(o.z,u.z,d.z,c.z,this.tension));return n.set(yc.calc(h),vc.calc(h),_c.calc(h)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new M().fromArray(r))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Xu(i,e,t,n,r){let a=.5*(n-e),s=.5*(r-t),o=i*i;return(2*t-2*n+a+s)*(i*o)+(-3*t+3*n-2*a-s)*o+a*i+t}function Ba(i,e,t,n){return(function(r,a){let s=1-r;return s*s*a})(i,e)+(function(r,a){return 2*(1-r)*r*a})(i,t)+(function(r,a){return r*r*a})(i,n)}function Fa(i,e,t,n,r){return(function(a,s){let o=1-a;return o*o*o*s})(i,e)+(function(a,s){let o=1-a;return 3*o*o*a*s})(i,t)+(function(a,s){return 3*(1-a)*a*a*s})(i,n)+(function(a,s){return a*a*a*s})(i,r)}var es=class extends Mn{constructor(e=new oe,t=new oe,n=new oe,r=new oe){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new oe){let n=t,r=this.v0,a=this.v1,s=this.v2,o=this.v3;return n.set(Fa(e,r.x,a.x,s.x,o.x),Fa(e,r.y,a.y,s.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Ro=class extends Mn{constructor(e=new M,t=new M,n=new M,r=new M){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new M){let n=t,r=this.v0,a=this.v1,s=this.v2,o=this.v3;return n.set(Fa(e,r.x,a.x,s.x,o.x),Fa(e,r.y,a.y,s.y,o.y),Fa(e,r.z,a.z,s.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},ts=class extends Mn{constructor(e=new oe,t=new oe){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new oe){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new oe){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Co=class extends Mn{constructor(e=new M,t=new M){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new M){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new M){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ns=class extends Mn{constructor(e=new oe,t=new oe,n=new oe){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new oe){let n=t,r=this.v0,a=this.v1,s=this.v2;return n.set(Ba(e,r.x,a.x,s.x),Ba(e,r.y,a.y,s.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},rs=class extends Mn{constructor(e=new M,t=new M,n=new M){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new M){let n=t,r=this.v0,a=this.v1,s=this.v2;return n.set(Ba(e,r.x,a.x,s.x),Ba(e,r.y,a.y,s.y),Ba(e,r.z,a.z,s.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},is=class extends Mn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new oe){let n=t,r=this.points,a=(r.length-1)*e,s=Math.floor(a),o=a-s,c=r[s===0?s:s-1],l=r[s],h=r[s>r.length-2?r.length-1:s+1],u=r[s>r.length-3?r.length-1:s+2];return n.set(Xu(o,c.x,l.x,h.x,u.x),Xu(o,c.y,l.y,h.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(r.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let r=this.points[t];e.points.push(r.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let r=e.points[t];this.points.push(new oe().fromArray(r))}return this}},Io=Object.freeze({__proto__:null,ArcCurve:wo,CatmullRomCurve3:Ao,CubicBezierCurve:es,CubicBezierCurve3:Ro,EllipseCurve:$i,LineCurve:ts,LineCurve3:Co,QuadraticBezierCurve:ns,QuadraticBezierCurve3:rs,SplineCurve:is}),Lo=class extends Mn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Io[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),r=this.getCurveLengths(),a=0;for(;a<r.length;){if(r[a]>=n){let s=r[a]-n,o=this.curves[a],c=o.getLength(),l=c===0?0:1-s/c;return o.getPointAt(l,t)}a++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,r=this.curves.length;n<r;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let r=0,a=this.curves;r<a.length;r++){let s=a[r],o=s.isEllipseCurve?2*e:s.isLineCurve||s.isLineCurve3?1:s.isSplineCurve?e*s.points.length:e,c=s.getPoints(o);for(let l=0;l<c.length;l++){let h=c[l];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let r=e.curves[t];this.curves.push(r.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let r=this.curves[t];e.curves.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let r=e.curves[t];this.curves.push(new Io[r.type]().fromJSON(r))}return this}},as=class extends Lo{constructor(e){super(),this.type="Path",this.currentPoint=new oe,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new ts(this.currentPoint.clone(),new oe(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,r){let a=new ns(this.currentPoint.clone(),new oe(e,t),new oe(n,r));return this.curves.push(a),this.currentPoint.set(n,r),this}bezierCurveTo(e,t,n,r,a,s){let o=new es(this.currentPoint.clone(),new oe(e,t),new oe(n,r),new oe(a,s));return this.curves.push(o),this.currentPoint.set(a,s),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new is(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,r,a,s){let o=this.currentPoint.x,c=this.currentPoint.y;return this.absarc(e+o,t+c,n,r,a,s),this}absarc(e,t,n,r,a,s){return this.absellipse(e,t,n,n,r,a,s),this}ellipse(e,t,n,r,a,s,o,c){let l=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+l,t+h,n,r,a,s,o,c),this}absellipse(e,t,n,r,a,s,o,c){let l=new $i(e,t,n,r,a,s,o,c);if(this.curves.length>0){let u=l.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(l);let h=l.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},ss=class extends as{constructor(e){super(e),this.uuid=pi(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,r=this.holes.length;n<r;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let r=e.holes[t];this.holes.push(r.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let r=this.holes[t];e.holes.push(r.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let r=e.holes[t];this.holes.push(new as().fromJSON(r))}return this}};function rf(i,e,t=2){let n=e&&e.length,r=n?e[0]*t:i.length,a=ju(i,0,r,t,!0),s=[];if(!a||a.next===a.prev)return s;let o,c,l;if(n&&(a=(function(h,u,d,p){let f=[];for(let _=0,m=u.length;_<m;_++){let g=ju(h,u[_]*p,_<m-1?u[_+1]*p:h.length,p,!1);g===g.next&&(g.steiner=!0),f.push(df(g))}f.sort(cf);for(let _=0;_<f.length;_++)d=hf(f[_],d);return d})(i,e,a,t)),i.length>80*t){o=1/0,c=1/0;let h=-1/0,u=-1/0;for(let d=t;d<r;d+=t){let p=i[d],f=i[d+1];p<o&&(o=p),f<c&&(c=f),p>h&&(h=p),f>u&&(u=f)}l=Math.max(h-o,u-c),l=l!==0?32767/l:0}return os(a,s,t,o,c,l,0),s}function ju(i,e,t,n,r){let a;if(r===(function(s,o,c,l){let h=0;for(let u=o,d=c-l;u<c;u+=l)h+=(s[d]-s[u])*(s[u+1]+s[d+1]),d=u;return h})(i,e,t,n)>0)for(let s=e;s<t;s+=n)a=qu(s/n|0,i[s],i[s+1],a);else for(let s=t-n;s>=e;s-=n)a=qu(s/n|0,i[s],i[s+1],a);return a&&Qi(a,a.next)&&(cs(a),a=a.next),a}function ri(i,e){if(!i)return i;e||(e=i);let t,n=i;do if(t=!1,n.steiner||!Qi(n,n.next)&&Pt(n.prev,n,n.next)!==0)n=n.next;else{if(cs(n),n=e=n.prev,n===n.next)break;t=!0}while(t||n!==e);return e}function os(i,e,t,n,r,a,s){if(!i)return;!s&&a&&(function(c,l,h,u){let d=c;do d.z===0&&(d.z=Ic(d.x,d.y,l,h,u)),d.prevZ=d.prev,d.nextZ=d.next,d=d.next;while(d!==c);d.prevZ.nextZ=null,d.prevZ=null,(function(p){let f,_=1;do{let m,g=p;p=null;let y=null;for(f=0;g;){f++;let x=g,b=0;for(let I=0;I<_&&(b++,x=x.nextZ,x);I++);let L=_;for(;b>0||L>0&&x;)b!==0&&(L===0||!x||g.z<=x.z)?(m=g,g=g.nextZ,b--):(m=x,x=x.nextZ,L--),y?y.nextZ=m:p=m,m.prevZ=y,y=m;g=x}y.nextZ=null,_*=2}while(f>1)})(d)})(i,n,r,a);let o=i;for(;i.prev!==i.next;){let c=i.prev,l=i.next;if(a?sf(i,n,r,a):af(i))e.push(c.i,i.i,l.i),cs(i),i=l.next,o=l.next;else if((i=l)===o){s?s===1?os(i=of(ri(i),e),e,t,n,r,a,2):s===2&&lf(i,e,t,n,r,a):os(ri(i),e,t,n,r,a,1);break}}}function af(i){let e=i.prev,t=i,n=i.next;if(Pt(e,t,n)>=0)return!1;let r=e.x,a=t.x,s=n.x,o=e.y,c=t.y,l=n.y,h=Math.min(r,a,s),u=Math.min(o,c,l),d=Math.max(r,a,s),p=Math.max(o,c,l),f=n.next;for(;f!==e;){if(f.x>=h&&f.x<=d&&f.y>=u&&f.y<=p&&Ua(r,o,a,c,s,l,f.x,f.y)&&Pt(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function sf(i,e,t,n){let r=i.prev,a=i,s=i.next;if(Pt(r,a,s)>=0)return!1;let o=r.x,c=a.x,l=s.x,h=r.y,u=a.y,d=s.y,p=Math.min(o,c,l),f=Math.min(h,u,d),_=Math.max(o,c,l),m=Math.max(h,u,d),g=Ic(p,f,e,t,n),y=Ic(_,m,e,t,n),x=i.prevZ,b=i.nextZ;for(;x&&x.z>=g&&b&&b.z<=y;){if(x.x>=p&&x.x<=_&&x.y>=f&&x.y<=m&&x!==r&&x!==s&&Ua(o,h,c,u,l,d,x.x,x.y)&&Pt(x.prev,x,x.next)>=0||(x=x.prevZ,b.x>=p&&b.x<=_&&b.y>=f&&b.y<=m&&b!==r&&b!==s&&Ua(o,h,c,u,l,d,b.x,b.y)&&Pt(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;x&&x.z>=g;){if(x.x>=p&&x.x<=_&&x.y>=f&&x.y<=m&&x!==r&&x!==s&&Ua(o,h,c,u,l,d,x.x,x.y)&&Pt(x.prev,x,x.next)>=0)return!1;x=x.prevZ}for(;b&&b.z<=y;){if(b.x>=p&&b.x<=_&&b.y>=f&&b.y<=m&&b!==r&&b!==s&&Ua(o,h,c,u,l,d,b.x,b.y)&&Pt(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function of(i,e){let t=i;do{let n=t.prev,r=t.next.next;!Qi(n,r)&&ep(n,t,t.next,r)&&ls(n,r)&&ls(r,n)&&(e.push(n.i,t.i,r.i),cs(t),cs(t.next),t=i=r),t=t.next}while(t!==i);return ri(t)}function lf(i,e,t,n,r,a){let s=i;do{let o=s.next.next;for(;o!==s.prev;){if(s.i!==o.i&&pf(s,o)){let c=tp(s,o);return s=ri(s,s.next),c=ri(c,c.next),os(s,e,t,n,r,a,0),void os(c,e,t,n,r,a,0)}o=o.next}s=s.next}while(s!==i)}function cf(i,e){let t=i.x-e.x;return t===0&&(t=i.y-e.y,t===0)&&(t=(i.next.y-i.y)/(i.next.x-i.x)-(e.next.y-e.y)/(e.next.x-e.x)),t}function hf(i,e){let t=(function(r,a){let s=a,o=r.x,c=r.y,l,h=-1/0;if(Qi(r,s))return s;do{if(Qi(r,s.next))return s.next;if(c<=s.y&&c>=s.next.y&&s.next.y!==s.y){let _=s.x+(c-s.y)*(s.next.x-s.x)/(s.next.y-s.y);if(_<=o&&_>h&&(h=_,l=s.x<s.next.x?s:s.next,_===o))return l}s=s.next}while(s!==a);if(!l)return null;let u=l,d=l.x,p=l.y,f=1/0;s=l;do{if(o>=s.x&&s.x>=d&&o!==s.x&&Qd(c<p?o:h,c,d,p,c<p?h:o,c,s.x,s.y)){let _=Math.abs(c-s.y)/(o-s.x);ls(s,r)&&(_<f||_===f&&(s.x>l.x||s.x===l.x&&uf(l,s)))&&(l=s,f=_)}s=s.next}while(s!==u);return l})(i,e);if(!t)return e;let n=tp(t,i);return ri(n,n.next),ri(t,t.next)}function uf(i,e){return Pt(i.prev,i,e.prev)<0&&Pt(e.next,i,i.next)<0}function Ic(i,e,t,n,r){return(i=1431655765&((i=858993459&((i=252645135&((i=16711935&((i=(i-t)*r|0)|i<<8))|i<<4))|i<<2))|i<<1))|(e=1431655765&((e=858993459&((e=252645135&((e=16711935&((e=(e-n)*r|0)|e<<8))|e<<4))|e<<2))|e<<1))<<1}function df(i){let e=i,t=i;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==i);return t}function Qd(i,e,t,n,r,a,s,o){return(r-s)*(e-o)>=(i-s)*(a-o)&&(i-s)*(n-o)>=(t-s)*(e-o)&&(t-s)*(a-o)>=(r-s)*(n-o)}function Ua(i,e,t,n,r,a,s,o){return!(i===s&&e===o)&&Qd(i,e,t,n,r,a,s,o)}function pf(i,e){return i.next.i!==e.i&&i.prev.i!==e.i&&!(function(t,n){let r=t;do{if(r.i!==t.i&&r.next.i!==t.i&&r.i!==n.i&&r.next.i!==n.i&&ep(r,r.next,t,n))return!0;r=r.next}while(r!==t);return!1})(i,e)&&(ls(i,e)&&ls(e,i)&&(function(t,n){let r=t,a=!1,s=(t.x+n.x)/2,o=(t.y+n.y)/2;do r.y>o!=r.next.y>o&&r.next.y!==r.y&&s<(r.next.x-r.x)*(o-r.y)/(r.next.y-r.y)+r.x&&(a=!a),r=r.next;while(r!==t);return a})(i,e)&&(Pt(i.prev,i,e.prev)||Pt(i,e.prev,e))||Qi(i,e)&&Pt(i.prev,i,i.next)>0&&Pt(e.prev,e,e.next)>0)}function Pt(i,e,t){return(e.y-i.y)*(t.x-e.x)-(e.x-i.x)*(t.y-e.y)}function Qi(i,e){return i.x===e.x&&i.y===e.y}function ep(i,e,t,n){let r=so(Pt(i,e,t)),a=so(Pt(i,e,n)),s=so(Pt(t,n,i)),o=so(Pt(t,n,e));return r!==a&&s!==o||!(r!==0||!ao(i,t,e))||!(a!==0||!ao(i,n,e))||!(s!==0||!ao(t,i,n))||!(o!==0||!ao(t,e,n))}function ao(i,e,t){return e.x<=Math.max(i.x,t.x)&&e.x>=Math.min(i.x,t.x)&&e.y<=Math.max(i.y,t.y)&&e.y>=Math.min(i.y,t.y)}function so(i){return i>0?1:i<0?-1:0}function ls(i,e){return Pt(i.prev,i,i.next)<0?Pt(i,e,i.next)>=0&&Pt(i,i.prev,e)>=0:Pt(i,e,i.prev)<0||Pt(i,i.next,e)<0}function tp(i,e){let t=Lc(i.i,i.x,i.y),n=Lc(e.i,e.x,e.y),r=i.next,a=e.prev;return i.next=e,e.prev=i,t.next=r,r.prev=t,n.next=t,t.prev=n,a.next=n,n.prev=a,n}function qu(i,e,t,n){let r=Lc(i,e,t);return n?(r.next=n.next,r.prev=n,n.next.prev=r,n.next=r):(r.prev=r,r.next=r),r}function cs(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function Lc(i,e,t){return{i,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}var Pc=class{static triangulate(e,t,n=2){return rf(e,t,n)}},$n=class i{static area(e){let t=e.length,n=0;for(let r=t-1,a=0;a<t;r=a++)n+=e[r].x*e[a].y-e[a].x*e[r].y;return .5*n}static isClockWise(e){return i.area(e)<0}static triangulateShape(e,t){let n=[],r=[],a=[];Yu(e),Ku(n,e);let s=e.length;t.forEach(Yu);for(let c=0;c<t.length;c++)r.push(s),s+=t[c].length,Ku(n,t[c]);let o=Pc.triangulate(n,r);for(let c=0;c<o.length;c+=3)a.push(o.slice(c,c+3));return a}};function Yu(i){let e=i.length;e>2&&i[e-1].equals(i[0])&&i.pop()}function Ku(i,e){for(let t=0;t<e.length;t++)i.push(e[t].x),i.push(e[t].y)}var Po=class i extends tt{constructor(e=new ss([new oe(.5,.5),new oe(-.5,.5),new oe(-.5,-.5),new oe(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,r=[],a=[];for(let o=0,c=e.length;o<c;o++)s(e[o]);function s(o){let c=[],l=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,u=t.depth!==void 0?t.depth:1,d=t.bevelEnabled===void 0||t.bevelEnabled,p=t.bevelThickness!==void 0?t.bevelThickness:.2,f=t.bevelSize!==void 0?t.bevelSize:p-.1,_=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3,g=t.extrudePath,y=t.UVGenerator!==void 0?t.UVGenerator:mf,x,b,L,I,B,G=!1;g&&(x=g.getSpacedPoints(h),G=!0,d=!1,b=g.computeFrenetFrames(h,!1),L=new M,I=new M,B=new M),d||(m=0,p=0,f=0,_=0);let F=o.extractPoints(l),j=F.shape,K=F.holes;if(!$n.isClockWise(j)){j=j.reverse();for(let D=0,E=K.length;D<E;D++){let R=K[D];$n.isClockWise(R)&&(K[D]=R.reverse())}}function z(D){let E=10000000000000001e-36,R=D[0];for(let U=1;U<=D.length;U++){let P=U%D.length,te=D[P],V=te.x-R.x,W=te.y-R.y,de=V*V+W*W,fe=Math.max(Math.abs(te.x),Math.abs(te.y),Math.abs(R.x),Math.abs(R.y));de<=E*fe*fe?(D.splice(P,1),U--):R=te}}z(j),K.forEach(z);let Z=K.length,X=j;for(let D=0;D<Z;D++){let E=K[D];j=j.concat(E)}function Q(D,E,R){return E||console.error("THREE.ExtrudeGeometry: vec does not exist"),D.clone().addScaledVector(E,R)}let ie=j.length;function pe(D,E,R){let U,P,te,V=D.x-E.x,W=D.y-E.y,de=R.x-D.x,fe=R.y-D.y,he=V*V+W*W,be=V*fe-W*de;if(Math.abs(be)>Number.EPSILON){let Ae=Math.sqrt(he),Ne=Math.sqrt(de*de+fe*fe),$e=E.x-W/Ae,it=E.y+V/Ae,nt=((R.x-fe/Ne-$e)*fe-(R.y+de/Ne-it)*de)/(V*fe-W*de);U=$e+V*nt-D.x,P=it+W*nt-D.y;let xe=U*U+P*P;if(xe<=2)return new oe(U,P);te=Math.sqrt(xe/2)}else{let Ae=!1;V>Number.EPSILON?de>Number.EPSILON&&(Ae=!0):V<-Number.EPSILON?de<-Number.EPSILON&&(Ae=!0):Math.sign(W)===Math.sign(fe)&&(Ae=!0),Ae?(U=-W,P=V,te=Math.sqrt(he)):(U=V,P=W,te=Math.sqrt(he/2))}return new oe(U/te,P/te)}let ae=[];for(let D=0,E=X.length,R=E-1,U=D+1;D<E;D++,R++,U++)R===E&&(R=0),U===E&&(U=0),ae[D]=pe(X[D],X[R],X[U]);let Se=[],Pe,ve,Re=ae.concat();for(let D=0,E=Z;D<E;D++){let R=K[D];Pe=[];for(let U=0,P=R.length,te=P-1,V=U+1;U<P;U++,te++,V++)te===P&&(te=0),V===P&&(V=0),Pe[U]=pe(R[U],R[te],R[V]);Se.push(Pe),Re=Re.concat(Pe)}if(m===0)ve=$n.triangulateShape(X,K);else{let D=[],E=[];for(let R=0;R<m;R++){let U=R/m,P=p*Math.cos(U*Math.PI/2),te=f*Math.sin(U*Math.PI/2)+_;for(let V=0,W=X.length;V<W;V++){let de=Q(X[V],ae[V],te);De(de.x,de.y,-P),U===0&&D.push(de)}for(let V=0,W=Z;V<W;V++){let de=K[V];Pe=Se[V];let fe=[];for(let he=0,be=de.length;he<be;he++){let Ae=Q(de[he],Pe[he],te);De(Ae.x,Ae.y,-P),U===0&&fe.push(Ae)}U===0&&E.push(fe)}}ve=$n.triangulateShape(D,E)}let ue=ve.length,ge=f+_;for(let D=0;D<ie;D++){let E=d?Q(j[D],Re[D],ge):j[D];G?(I.copy(b.normals[0]).multiplyScalar(E.x),L.copy(b.binormals[0]).multiplyScalar(E.y),B.copy(x[0]).add(I).add(L),De(B.x,B.y,B.z)):De(E.x,E.y,0)}for(let D=1;D<=h;D++)for(let E=0;E<ie;E++){let R=d?Q(j[E],Re[E],ge):j[E];G?(I.copy(b.normals[D]).multiplyScalar(R.x),L.copy(b.binormals[D]).multiplyScalar(R.y),B.copy(x[D]).add(I).add(L),De(B.x,B.y,B.z)):De(R.x,R.y,u/h*D)}for(let D=m-1;D>=0;D--){let E=D/m,R=p*Math.cos(E*Math.PI/2),U=f*Math.sin(E*Math.PI/2)+_;for(let P=0,te=X.length;P<te;P++){let V=Q(X[P],ae[P],U);De(V.x,V.y,u+R)}for(let P=0,te=K.length;P<te;P++){let V=K[P];Pe=Se[P];for(let W=0,de=V.length;W<de;W++){let fe=Q(V[W],Pe[W],U);G?De(fe.x,fe.y+x[h-1].y,x[h-1].x+R):De(fe.x,fe.y,u+R)}}}function me(D,E){let R=D.length;for(;--R>=0;){let U=R,P=R-1;P<0&&(P=D.length-1);for(let te=0,V=h+2*m;te<V;te++){let W=ie*te,de=ie*(te+1);w(E+U+W,E+P+W,E+P+de,E+U+de)}}}function De(D,E,R){c.push(D),c.push(E),c.push(R)}function Ve(D,E,R){T(D),T(E),T(R);let U=r.length/3,P=y.generateTopUV(n,r,U-3,U-2,U-1);H(P[0]),H(P[1]),H(P[2])}function w(D,E,R,U){T(D),T(E),T(U),T(E),T(R),T(U);let P=r.length/3,te=y.generateSideWallUV(n,r,P-6,P-3,P-2,P-1);H(te[0]),H(te[1]),H(te[3]),H(te[1]),H(te[2]),H(te[3])}function T(D){r.push(c[3*D+0]),r.push(c[3*D+1]),r.push(c[3*D+2])}function H(D){a.push(D.x),a.push(D.y)}(function(){let D=r.length/3;if(d){let E=0,R=ie*E;for(let U=0;U<ue;U++){let P=ve[U];Ve(P[2]+R,P[1]+R,P[0]+R)}E=h+2*m,R=ie*E;for(let U=0;U<ue;U++){let P=ve[U];Ve(P[0]+R,P[1]+R,P[2]+R)}}else{for(let E=0;E<ue;E++){let R=ve[E];Ve(R[2],R[1],R[0])}for(let E=0;E<ue;E++){let R=ve[E];Ve(R[0]+ie*h,R[1]+ie*h,R[2]+ie*h)}}n.addGroup(D,r.length/3-D,0)})(),(function(){let D=r.length/3,E=0;me(X,E),E+=X.length;for(let R=0,U=K.length;R<U;R++){let P=K[R];me(P,E),E+=P.length}n.addGroup(D,r.length/3-D,1)})()}this.setAttribute("position",new Le(r,3)),this.setAttribute("uv",new Le(a,2)),this.computeVertexNormals()}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return(function(t,n,r){if(r.shapes=[],Array.isArray(t))for(let a=0,s=t.length;a<s;a++){let o=t[a];r.shapes.push(o.uuid)}else r.shapes.push(t.uuid);return r.options=Object.assign({},n),n.extrudePath!==void 0&&(r.options.extrudePath=n.extrudePath.toJSON()),r})(this.parameters.shapes,this.parameters.options,e)}static fromJSON(e,t){let n=[];for(let a=0,s=e.shapes.length;a<s;a++){let o=t[e.shapes[a]];n.push(o)}let r=e.options.extrudePath;return r!==void 0&&(e.options.extrudePath=new Io[r.type]().fromJSON(r)),new i(n,e.options)}},mf={generateTopUV:function(i,e,t,n,r){let a=e[3*t],s=e[3*t+1],o=e[3*n],c=e[3*n+1],l=e[3*r],h=e[3*r+1];return[new oe(a,s),new oe(o,c),new oe(l,h)]},generateSideWallUV:function(i,e,t,n,r,a){let s=e[3*t],o=e[3*t+1],c=e[3*t+2],l=e[3*n],h=e[3*n+1],u=e[3*n+2],d=e[3*r],p=e[3*r+1],f=e[3*r+2],_=e[3*a],m=e[3*a+1],g=e[3*a+2];return Math.abs(o-h)<Math.abs(s-l)?[new oe(s,1-c),new oe(l,1-u),new oe(d,1-f),new oe(_,1-g)]:[new oe(o,1-c),new oe(h,1-u),new oe(p,1-f),new oe(m,1-g)]}},Ur=class i extends Nr{constructor(e=1,t=0){let n=(1+Math.sqrt(5))/2;super([-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1],e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},Do=class i extends tt{constructor(e=[new oe(0,-.5),new oe(.5,0),new oe(0,.5)],t=12,n=0,r=2*Math.PI){super(),this.type="LatheGeometry",this.parameters={points:e,segments:t,phiStart:n,phiLength:r},t=Math.floor(t),r=Ye(r,0,2*Math.PI);let a=[],s=[],o=[],c=[],l=[],h=1/t,u=new M,d=new oe,p=new M,f=new M,_=new M,m=0,g=0;for(let y=0;y<=e.length-1;y++)switch(y){case 0:m=e[y+1].x-e[y].x,g=e[y+1].y-e[y].y,p.x=1*g,p.y=-m,p.z=0*g,_.copy(p),p.normalize(),c.push(p.x,p.y,p.z);break;case e.length-1:c.push(_.x,_.y,_.z);break;default:m=e[y+1].x-e[y].x,g=e[y+1].y-e[y].y,p.x=1*g,p.y=-m,p.z=0*g,f.copy(p),p.x+=_.x,p.y+=_.y,p.z+=_.z,p.normalize(),c.push(p.x,p.y,p.z),_.copy(f)}for(let y=0;y<=t;y++){let x=n+y*h*r,b=Math.sin(x),L=Math.cos(x);for(let I=0;I<=e.length-1;I++){u.x=e[I].x*b,u.y=e[I].y,u.z=e[I].x*L,s.push(u.x,u.y,u.z),d.x=y/t,d.y=I/(e.length-1),o.push(d.x,d.y);let B=c[3*I+0]*b,G=c[3*I+1],F=c[3*I+0]*L;l.push(B,G,F)}}for(let y=0;y<t;y++)for(let x=0;x<e.length-1;x++){let b=x+y*e.length,L=b,I=b+e.length,B=b+e.length+1,G=b+1;a.push(L,I,G),a.push(B,G,I)}this.setIndex(a),this.setAttribute("position",new Le(s,3)),this.setAttribute("uv",new Le(o,2)),this.setAttribute("normal",new Le(l,3))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.points,e.segments,e.phiStart,e.phiLength)}},ea=class i extends Nr{constructor(e=1,t=0){super([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type="OctahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},ta=class i extends tt{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let a=e/2,s=t/2,o=Math.floor(n),c=Math.floor(r),l=o+1,h=c+1,u=e/o,d=t/c,p=[],f=[],_=[],m=[];for(let g=0;g<h;g++){let y=g*d-s;for(let x=0;x<l;x++){let b=x*u-a;f.push(b,-y,0),_.push(0,0,1),m.push(x/o),m.push(1-g/c)}}for(let g=0;g<c;g++)for(let y=0;y<o;y++){let x=y+l*g,b=y+l*(g+1),L=y+1+l*(g+1),I=y+1+l*g;p.push(x,b,I),p.push(b,L,I)}this.setIndex(p),this.setAttribute("position",new Le(f,3)),this.setAttribute("normal",new Le(_,3)),this.setAttribute("uv",new Le(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}},No=class i extends tt{constructor(e=.5,t=1,n=32,r=1,a=0,s=2*Math.PI){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:r,thetaStart:a,thetaLength:s},n=Math.max(3,n);let o=[],c=[],l=[],h=[],u=e,d=(t-e)/(r=Math.max(1,r)),p=new M,f=new oe;for(let _=0;_<=r;_++){for(let m=0;m<=n;m++){let g=a+m/n*s;p.x=u*Math.cos(g),p.y=u*Math.sin(g),c.push(p.x,p.y,p.z),l.push(0,0,1),f.x=(p.x/t+1)/2,f.y=(p.y/t+1)/2,h.push(f.x,f.y)}u+=d}for(let _=0;_<r;_++){let m=_*(n+1);for(let g=0;g<n;g++){let y=g+m,x=y,b=y+n+1,L=y+n+2,I=y+1;o.push(x,b,I),o.push(b,L,I)}}this.setIndex(o),this.setAttribute("position",new Le(c,3)),this.setAttribute("normal",new Le(l,3)),this.setAttribute("uv",new Le(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}},Uo=class i extends tt{constructor(e=new ss([new oe(0,.5),new oe(-.5,-.5),new oe(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],r=[],a=[],s=[],o=0,c=0;if(Array.isArray(e)===!1)l(e);else for(let h=0;h<e.length;h++)l(e[h]),this.addGroup(o,c,h),o+=c,c=0;function l(h){let u=r.length/3,d=h.extractPoints(t),p=d.shape,f=d.holes;$n.isClockWise(p)===!1&&(p=p.reverse());for(let m=0,g=f.length;m<g;m++){let y=f[m];$n.isClockWise(y)===!0&&(f[m]=y.reverse())}let _=$n.triangulateShape(p,f);for(let m=0,g=f.length;m<g;m++){let y=f[m];p=p.concat(y)}for(let m=0,g=p.length;m<g;m++){let y=p[m];r.push(y.x,y.y,0),a.push(0,0,1),s.push(y.x,y.y)}for(let m=0,g=_.length;m<g;m++){let y=_[m],x=y[0]+u,b=y[1]+u,L=y[2]+u;n.push(x,b,L),c+=3}}this.setIndex(n),this.setAttribute("position",new Le(r,3)),this.setAttribute("normal",new Le(a,3)),this.setAttribute("uv",new Le(s,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return(function(t,n){if(n.shapes=[],Array.isArray(t))for(let r=0,a=t.length;r<a;r++){let s=t[r];n.shapes.push(s.uuid)}else n.shapes.push(t.uuid);return n})(this.parameters.shapes,e)}static fromJSON(e,t){let n=[];for(let r=0,a=e.shapes.length;r<a;r++){let s=t[e.shapes[r]];n.push(s)}return new i(n,e.curveSegments)}},Or=class i extends tt{constructor(e=1,t=32,n=16,r=0,a=2*Math.PI,s=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:r,phiLength:a,thetaStart:s,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let c=Math.min(s+o,Math.PI),l=0,h=[],u=new M,d=new M,p=[],f=[],_=[],m=[];for(let g=0;g<=n;g++){let y=[],x=g/n,b=0;g===0&&s===0?b=.5/t:g===n&&c===Math.PI&&(b=-.5/t);for(let L=0;L<=t;L++){let I=L/t;u.x=-e*Math.cos(r+I*a)*Math.sin(s+x*o),u.y=e*Math.cos(s+x*o),u.z=e*Math.sin(r+I*a)*Math.sin(s+x*o),f.push(u.x,u.y,u.z),d.copy(u).normalize(),_.push(d.x,d.y,d.z),m.push(I+b,1-x),y.push(l++)}h.push(y)}for(let g=0;g<n;g++)for(let y=0;y<t;y++){let x=h[g][y+1],b=h[g][y],L=h[g+1][y],I=h[g+1][y+1];(g!==0||s>0)&&p.push(x,b,I),(g!==n-1||c<Math.PI)&&p.push(b,L,I)}this.setIndex(p),this.setAttribute("position",new Le(f,3)),this.setAttribute("normal",new Le(_,3)),this.setAttribute("uv",new Le(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}},Oo=class i extends Nr{constructor(e=1,t=0){super([1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],[2,1,0,0,3,2,1,3,0,2,3,1],e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new i(e.radius,e.detail)}},Bo=class i extends tt{constructor(e=1,t=.4,n=12,r=48,a=2*Math.PI){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:r,arc:a},n=Math.floor(n),r=Math.floor(r);let s=[],o=[],c=[],l=[],h=new M,u=new M,d=new M;for(let p=0;p<=n;p++)for(let f=0;f<=r;f++){let _=f/r*a,m=p/n*Math.PI*2;u.x=(e+t*Math.cos(m))*Math.cos(_),u.y=(e+t*Math.cos(m))*Math.sin(_),u.z=t*Math.sin(m),o.push(u.x,u.y,u.z),h.x=e*Math.cos(_),h.y=e*Math.sin(_),d.subVectors(u,h).normalize(),c.push(d.x,d.y,d.z),l.push(f/r),l.push(p/n)}for(let p=1;p<=n;p++)for(let f=1;f<=r;f++){let _=(r+1)*p+f-1,m=(r+1)*(p-1)+f-1,g=(r+1)*(p-1)+f,y=(r+1)*p+f;s.push(_,m,y),s.push(m,g,y)}this.setIndex(s),this.setAttribute("position",new Le(o,3)),this.setAttribute("normal",new Le(c,3)),this.setAttribute("uv",new Le(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}},Fo=class i extends tt{constructor(e=1,t=.4,n=64,r=8,a=2,s=3){super(),this.type="TorusKnotGeometry",this.parameters={radius:e,tube:t,tubularSegments:n,radialSegments:r,p:a,q:s},n=Math.floor(n),r=Math.floor(r);let o=[],c=[],l=[],h=[],u=new M,d=new M,p=new M,f=new M,_=new M,m=new M,g=new M;for(let x=0;x<=n;++x){let b=x/n*a*Math.PI*2;y(b,a,s,e,p),y(b+.01,a,s,e,f),m.subVectors(f,p),g.addVectors(f,p),_.crossVectors(m,g),g.crossVectors(_,m),_.normalize(),g.normalize();for(let L=0;L<=r;++L){let I=L/r*Math.PI*2,B=-t*Math.cos(I),G=t*Math.sin(I);u.x=p.x+(B*g.x+G*_.x),u.y=p.y+(B*g.y+G*_.y),u.z=p.z+(B*g.z+G*_.z),c.push(u.x,u.y,u.z),d.subVectors(u,p).normalize(),l.push(d.x,d.y,d.z),h.push(x/n),h.push(L/r)}}for(let x=1;x<=n;x++)for(let b=1;b<=r;b++){let L=(r+1)*(x-1)+(b-1),I=(r+1)*x+(b-1),B=(r+1)*x+b,G=(r+1)*(x-1)+b;o.push(L,I,G),o.push(I,B,G)}function y(x,b,L,I,B){let G=Math.cos(x),F=Math.sin(x),j=L/b*x,K=Math.cos(j);B.x=I*(2+K)*.5*G,B.y=I*(2+K)*F*.5,B.z=I*Math.sin(j)*.5}this.setIndex(o),this.setAttribute("position",new Le(c,3)),this.setAttribute("normal",new Le(l,3)),this.setAttribute("uv",new Le(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.tube,e.tubularSegments,e.radialSegments,e.p,e.q)}},ko=class i extends tt{constructor(e=new rs(new M(-1,-1,0),new M(-1,1,0),new M(1,1,0)),t=64,n=1,r=8,a=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:n,radialSegments:r,closed:a};let s=e.computeFrenetFrames(t,a);this.tangents=s.tangents,this.normals=s.normals,this.binormals=s.binormals;let o=new M,c=new M,l=new oe,h=new M,u=[],d=[],p=[],f=[];function _(m){h=e.getPointAt(m/t,h);let g=s.normals[m],y=s.binormals[m];for(let x=0;x<=r;x++){let b=x/r*Math.PI*2,L=Math.sin(b),I=-Math.cos(b);c.x=I*g.x+L*y.x,c.y=I*g.y+L*y.y,c.z=I*g.z+L*y.z,c.normalize(),d.push(c.x,c.y,c.z),o.x=h.x+n*c.x,o.y=h.y+n*c.y,o.z=h.z+n*c.z,u.push(o.x,o.y,o.z)}}(function(){for(let m=0;m<t;m++)_(m);_(a===!1?t:0),(function(){for(let m=0;m<=t;m++)for(let g=0;g<=r;g++)l.x=m/t,l.y=g/r,p.push(l.x,l.y)})(),(function(){for(let m=1;m<=t;m++)for(let g=1;g<=r;g++){let y=(r+1)*(m-1)+(g-1),x=(r+1)*m+(g-1),b=(r+1)*m+g,L=(r+1)*(m-1)+g;f.push(y,x,L),f.push(x,b,L)}})()})(),this.setIndex(f),this.setAttribute("position",new Le(u,3)),this.setAttribute("normal",new Le(d,3)),this.setAttribute("uv",new Le(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new i(new Io[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}},ii=class extends tt{constructor(e=null){if(super(),this.type="WireframeGeometry",this.parameters={geometry:e},e!==null){let t=[],n=new Set,r=new M,a=new M;if(e.index!==null){let s=e.attributes.position,o=e.index,c=e.groups;c.length===0&&(c=[{start:0,count:o.count,materialIndex:0}]);for(let l=0,h=c.length;l<h;++l){let u=c[l],d=u.start;for(let p=d,f=d+u.count;p<f;p+=3)for(let _=0;_<3;_++){let m=o.getX(p+_),g=o.getX(p+(_+1)%3);r.fromBufferAttribute(s,m),a.fromBufferAttribute(s,g),Zu(r,a,n)===!0&&(t.push(r.x,r.y,r.z),t.push(a.x,a.y,a.z))}}}else{let s=e.attributes.position;for(let o=0,c=s.count/3;o<c;o++)for(let l=0;l<3;l++){let h=3*o+l,u=3*o+(l+1)%3;r.fromBufferAttribute(s,h),a.fromBufferAttribute(s,u),Zu(r,a,n)===!0&&(t.push(r.x,r.y,r.z),t.push(a.x,a.y,a.z))}}this.setAttribute("position",new Le(t,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}};function Zu(i,e,t){let n=`${i.x},${i.y},${i.z}-${e.x},${e.y},${e.z}`,r=`${e.x},${e.y},${e.z}-${i.x},${i.y},${i.z}`;return t.has(n)!==!0&&t.has(r)!==!0&&(t.add(n),t.add(r),!0)}var ry=Object.freeze({__proto__:null,BoxGeometry:En,CapsuleGeometry:bo,CircleGeometry:So,ConeGeometry:Qa,CylinderGeometry:$a,DodecahedronGeometry:To,EdgesGeometry:Ji,ExtrudeGeometry:Po,IcosahedronGeometry:Ur,LatheGeometry:Do,OctahedronGeometry:ea,PlaneGeometry:ta,PolyhedronGeometry:Nr,RingGeometry:No,ShapeGeometry:Uo,SphereGeometry:Or,TetrahedronGeometry:Oo,TorusGeometry:Bo,TorusKnotGeometry:Fo,TubeGeometry:ko,WireframeGeometry:ii});var na=class extends Gn{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new ke(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new oe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}};var ai=class extends Gn{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new ke(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ke(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new oe(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Pn,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ho=class extends Gn{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Vo=class extends Gn{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};var si=class extends Yt{constructor(e){super(),this.isLineDashedMaterial=!0,this.type="LineDashedMaterial",this.scale=1,this.dashSize=3,this.gapSize=1,this.setValues(e)}copy(e){return super.copy(e),this.scale=e.scale,this.dashSize=e.dashSize,this.gapSize=e.gapSize,this}};function oo(i,e){return i&&i.constructor!==e?typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i):i}function ff(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}var oi=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],a=t[n-1];n:{e:{let s;t:{r:if(!(e<r)){for(let o=n+2;;){if(r===void 0){if(e<a)break r;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(a=r,r=t[++n],e<r)break e}s=t.length;break t}if(!(e>=a)){let o=t[1];e<o&&(n=2,a=o);for(let c=n-2;;){if(a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===c)break;if(r=a,a=t[--n-1],e>=a)break e}s=n,n=0;break t}break n}for(;n<s;){let o=n+s>>>1;e<t[o]?s=o:n=o+1}if(r=t[n],a=t[n-1],a===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,a,r)}return this.interpolate_(n,a,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,a=e*r;for(let s=0;s!==r;++s)t[s]=n[a+s];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}},zo=class extends oi{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:bc,endingEnd:bc}}intervalChanged_(e,t,n){let r=this.parameterPositions,a=e-2,s=e+1,o=r[a],c=r[s];if(o===void 0)switch(this.getSettings_().endingStart){case Sc:a=e,o=2*t-n;break;case Tc:a=r.length-2,o=t+r[a]-r[a+1];break;default:a=e,o=n}if(c===void 0)switch(this.getSettings_().endingEnd){case Sc:s=e,c=2*n-t;break;case Tc:s=1,c=n+r[1]-r[0];break;default:s=e-1,c=t}let l=.5*(n-t),h=this.valueSize;this._weightPrev=l/(t-o),this._weightNext=l/(c-n),this._offsetPrev=a*h,this._offsetNext=s*h}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,c=e*o,l=c-o,h=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,p=this._weightNext,f=(n-t)/(r-t),_=f*f,m=_*f,g=-d*m+2*d*_-d*f,y=(1+d)*m+(-1.5-2*d)*_+(-.5+d)*f+1,x=(-1-p)*m+(1.5+p)*_+.5*f,b=p*m-p*_;for(let L=0;L!==o;++L)a[L]=g*s[h+L]+y*s[l+L]+x*s[c+L]+b*s[u+L];return a}},Go=class extends oi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,c=e*o,l=c-o,h=(n-t)/(r-t),u=1-h;for(let d=0;d!==o;++d)a[d]=s[l+d]*u+s[c+d]*h;return a}},Wo=class extends oi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},_n=class{constructor(e,t,n,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=oo(t,this.TimeBufferType),this.values=oo(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:oo(e.times,Array),values:oo(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(n.interpolation=r)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Wo(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Go(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new zo(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case ka:t=this.InterpolantFactoryMethodDiscrete;break;case po:t=this.InterpolantFactoryMethodLinear;break;case co:t=this.InterpolantFactoryMethodSmooth}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0){if(e===this.DefaultInterpolation)throw new Error(n);this.setInterpolation(this.DefaultInterpolation)}return console.warn("THREE.KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ka;case this.InterpolantFactoryMethodLinear:return po;case this.InterpolantFactoryMethodSmooth:return co}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e}return this}trim(e,t){let n=this.times,r=n.length,a=0,s=r-1;for(;a!==r&&n[a]<e;)++a;for(;s!==-1&&n[s]>t;)--s;if(++s,a!==0||s!==r){a>=s&&(s=Math.max(s,1),a=s-1);let o=this.getValueSize();this.times=n.slice(a,s),this.values=this.values.slice(a*o,s*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,r=this.values,a=n.length;a===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let s=null;for(let o=0;o!==a;o++){let c=n[o];if(typeof c=="number"&&isNaN(c)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,o,c),e=!1;break}if(s!==null&&s>c){console.error("THREE.KeyframeTrack: Out of order keys.",this,o,c,s),e=!1;break}s=c}if(r!==void 0&&ff(r))for(let o=0,c=r.length;o!==c;++o){let l=r[o];if(isNaN(l)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,o,l),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===co,a=e.length-1,s=1;for(let o=1;o<a;++o){let c=!1,l=e[o];if(l!==e[o+1]&&(o!==1||l!==e[0]))if(r)c=!0;else{let h=o*n,u=h-n,d=h+n;for(let p=0;p!==n;++p){let f=t[h+p];if(f!==t[u+p]||f!==t[d+p]){c=!0;break}}}if(c){if(o!==s){e[s]=e[o];let h=o*n,u=s*n;for(let d=0;d!==n;++d)t[u+d]=t[h+d]}++s}}if(a>0){e[s]=e[a];for(let o=a*n,c=s*n,l=0;l!==n;++l)t[c+l]=t[o+l];++s}return s!==e.length?(this.times=e.slice(0,s),this.values=t.slice(0,s*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=new this.constructor(this.name,e,t);return n.createInterpolant=this.createInterpolant,n}};_n.prototype.ValueTypeName="",_n.prototype.TimeBufferType=Float32Array,_n.prototype.ValueBufferType=Float32Array,_n.prototype.DefaultInterpolation=po;var Ir=class extends _n{constructor(e,t,n){super(e,t,n)}};Ir.prototype.ValueTypeName="bool",Ir.prototype.ValueBufferType=Array,Ir.prototype.DefaultInterpolation=ka,Ir.prototype.InterpolantFactoryMethodLinear=void 0,Ir.prototype.InterpolantFactoryMethodSmooth=void 0;var Xo=class extends _n{constructor(e,t,n,r){super(e,t,n,r)}};Xo.prototype.ValueTypeName="color";var jo=class extends _n{constructor(e,t,n,r){super(e,t,n,r)}};jo.prototype.ValueTypeName="number";var qo=class extends oi{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let a=this.resultBuffer,s=this.sampleValues,o=this.valueSize,c=(n-t)/(r-t),l=e*o;for(let h=l+o;l!==h;l+=4)dn.slerpFlat(a,0,s,l-o,s,l,c);return a}},hs=class extends _n{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new qo(this.times,this.values,this.getValueSize(),e)}};hs.prototype.ValueTypeName="quaternion",hs.prototype.InterpolantFactoryMethodSmooth=void 0;var Lr=class extends _n{constructor(e,t,n){super(e,t,n)}};Lr.prototype.ValueTypeName="string",Lr.prototype.ValueBufferType=Array,Lr.prototype.DefaultInterpolation=ka,Lr.prototype.InterpolantFactoryMethodLinear=void 0,Lr.prototype.InterpolantFactoryMethodSmooth=void 0;var Yo=class extends _n{constructor(e,t,n,r){super(e,t,n,r)}};Yo.prototype.ValueTypeName="vector";var Ko=class{constructor(e,t,n){let r=this,a,s=!1,o=0,c=0,l=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this.abortController=new AbortController,this.itemStart=function(h){c++,s===!1&&r.onStart!==void 0&&r.onStart(h,o,c),s=!0},this.itemEnd=function(h){o++,r.onProgress!==void 0&&r.onProgress(h,o,c),o===c&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(h){r.onError!==void 0&&r.onError(h)},this.resolveURL=function(h){return a?a(h):h},this.setURLModifier=function(h){return a=h,this},this.addHandler=function(h,u){return l.push(h,u),this},this.removeHandler=function(h){let u=l.indexOf(h);return u!==-1&&l.splice(u,2),this},this.getHandler=function(h){for(let u=0,d=l.length;u<d;u+=2){let p=l[u],f=l[u+1];if(p.global&&(p.lastIndex=0),p.test(h))return f}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}},np=new Ko,Zo=class{constructor(e){this.manager=e!==void 0?e:np,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,a){n.load(e,r,t,a)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Zo.DEFAULT_MATERIAL_NAME="__DEFAULT";var us=class extends At{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ke(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}};var xc=new Ke,Ju=new M,$u=new M,Dc=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new oe(512,512),this.mapType=or,this.map=null,this.mapPass=null,this.matrix=new Ke,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Pr,this._frameExtents=new oe(1,1),this._viewportCount=1,this._viewports=[new Rt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Ju.setFromMatrixPosition(e.matrixWorld),t.position.copy(Ju),$u.setFromMatrixPosition(e.target.matrixWorld),t.lookAt($u),t.updateMatrixWorld(),xc.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(xc,t.coordinateSystem,t.reversedDepth),t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(xc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),this.mapSize.x===512&&this.mapSize.y===512||(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}};var iy=new Ke,ay=new M,sy=new M;var ds=class extends Ki{constructor(e=-1,t=1,n=1,r=-1,a=.1,s=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=a,this.far=s,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,a,s){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=a,this.view.height=s,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,a=n-e,s=n+e,o=r+t,c=r-t;if(this.view!==null&&this.view.enabled){let l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=l*this.view.offsetX,s=a+l*this.view.width,o-=h*this.view.offsetY,c=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,s,o,c,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Nc=class extends Dc{constructor(){super(new ds(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},li=class extends us{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(At.DEFAULT_UP),this.updateMatrix(),this.target=new At,this.shadow=new Nc}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}},ps=class extends us{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}};var oy=new Ke,ly=new Ke,cy=new Ke;var Jo=class extends Qt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var hy=new M,uy=new dn,dy=new M,py=new M,my=new M;var fy=new M,gy=new dn,yy=new M,vy=new M;var Ah="\\[\\]\\.:\\/",gf=new RegExp("["+Ah+"]","g"),Ec="[^"+Ah+"]",yf="[^"+Ah.replace("\\.","")+"]",vf=new RegExp("^"+/((?:WC+[\/:])*)/.source.replace("WC",Ec)+/(WCOD+)?/.source.replace("WCOD",yf)+/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ec)+/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ec)+"$"),_f=["material","materials","bones","map"],wt=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(gf,"")}static parseTrackName(e){let t=vf.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let a=n.nodeName.substring(r+1);_f.indexOf(a)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=a)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(a){for(let s=0;s<a.length;s++){let o=a[s];if(o.name===t||o.uuid===t)return o;let c=n(o.children);if(c)return c}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,a=n.length;r!==a;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,r=t.propertyName,a=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e)return void console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");if(n){let l=t.objectIndex;switch(n){case"materials":if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.materials)return void console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);e=e.material.materials;break;case"bones":if(!e.skeleton)return void console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===l){l=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material)return void console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);if(!e.material.map)return void console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);e=e.material.map;break;default:if(e[n]===void 0)return void console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);e=e[n]}if(l!==void 0){if(e[l]===void 0)return void console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);e=e[l]}}let s=e[r];if(s===void 0){let l=t.nodeName;return void console.error("THREE.PropertyBinding: Trying to update property for track: "+l+"."+r+" but it wasn't found.",e)}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);if(!e.geometry.morphAttributes)return void console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);e.morphTargetDictionary[a]!==void 0&&(a=e.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=s,this.propertyIndex=a}else s.fromArray!==void 0&&s.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=s):Array.isArray(s)?(c=this.BindingType.EntireArray,this.resolvedProperty=s):this.propertyName=r;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};wt.Composite=class{constructor(i,e,t){let n=t||wt.parseTrackName(e);this._targetGroup=i,this._bindings=i.subscribe_(e,n)}getValue(i,e){this.bind();let t=this._targetGroup.nCachedObjects_,n=this._bindings[t];n!==void 0&&n.getValue(i,e)}setValue(i,e){let t=this._bindings;for(let n=this._targetGroup.nCachedObjects_,r=t.length;n!==r;++n)t[n].setValue(i,e)}bind(){let i=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=i.length;e!==t;++e)i[e].bind()}unbind(){let i=this._bindings;for(let e=this._targetGroup.nCachedObjects_,t=i.length;e!==t;++e)i[e].unbind()}},wt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},wt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},wt.prototype.GetterByBindingType=[wt.prototype._getValue_direct,wt.prototype._getValue_array,wt.prototype._getValue_arrayElement,wt.prototype._getValue_toArray],wt.prototype.SetterByBindingTypeAndVersioning=[[wt.prototype._setValue_direct,wt.prototype._setValue_direct_setNeedsUpdate,wt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[wt.prototype._setValue_array,wt.prototype._setValue_array_setNeedsUpdate,wt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[wt.prototype._setValue_arrayElement,wt.prototype._setValue_arrayElement_setNeedsUpdate,wt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[wt.prototype._setValue_fromArray,wt.prototype._setValue_fromArray_setNeedsUpdate,wt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var _y=new Float32Array(1);var Qu=new Ke,ms=class{constructor(e,t,n=0,r=1/0){this.ray=new rr(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new Yi,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):console.error("THREE.Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Qu.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Qu),this}intersectObject(e,t=!0,n=[]){return Uc(e,this,n,t),n.sort(ed),n}intersectObjects(e,t=!0,n=[]){for(let r=0,a=e.length;r<a;r++)Uc(e[r],this,n,t);return n.sort(ed),n}};function ed(i,e){return i.distance-e.distance}function Uc(i,e,t,n){let r=!0;if(i.layers.test(e.layers)&&i.raycast(e,t)===!1&&(r=!1),r===!0&&n===!0){let a=i.children;for(let s=0,o=a.length;s<o;s++)Uc(a[s],e,t,!0)}}var ra=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=Ye(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Ye(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var xy=new oe;var Ey=new M,My=new M,by=new M,Sy=new M,Ty=new M,wy=new M,Ay=new M;var Ry=new M;var Cy=new M,Iy=new Ke,Ly=new Ke;var Py=new M,Dy=new ke,Ny=new ke;var Uy=new M,Oy=new M,By=new M;var Fy=new M,ky=new Ki;var Hy=new In;var td=new M,lo,Mc,fs=class extends At{constructor(e=new M(0,0,1),t=new M(0,0,0),n=1,r=16776960,a=.2*n,s=.2*a){super(),this.type="ArrowHelper",lo===void 0&&(lo=new tt,lo.setAttribute("position",new Le([0,0,0,0,1,0],3)),Mc=new Qa(.5,1,5,1),Mc.translate(0,-.5,0)),this.position.copy(t),this.line=new Dn(lo,new Yt({color:r,toneMapped:!1})),this.line.matrixAutoUpdate=!1,this.add(this.line),this.cone=new Bt(Mc,new xn({color:r,toneMapped:!1})),this.cone.matrixAutoUpdate=!1,this.add(this.cone),this.setDirection(e),this.setLength(n,a,s)}setDirection(e){if(e.y>.99999)this.quaternion.set(0,0,0,1);else if(e.y<-.99999)this.quaternion.set(1,0,0,0);else{td.set(e.z,0,-e.x).normalize();let t=Math.acos(e.y);this.quaternion.setFromAxisAngle(td,t)}}setLength(e,t=.2*e,n=.2*t){this.line.scale.set(1,Math.max(1e-4,e-t),1),this.line.updateMatrix(),this.cone.scale.set(n,t,n),this.cone.position.y=e,this.cone.updateMatrix()}setColor(e){this.line.material.color.set(e),this.cone.material.color.set(e)}copy(e){return super.copy(e,!1),this.line.copy(e.line),this.cone.copy(e.cone),this}dispose(){this.line.geometry.dispose(),this.line.material.dispose(),this.cone.geometry.dispose(),this.cone.material.dispose()}};var gs=class extends tr{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){e!==void 0?(this.domElement!==null&&this.disconnect(),this.domElement=e):console.warn("THREE.Controls: connect() now requires an element.")}disconnect(){}dispose(){}update(){}};function Rh(i,e,t,n){let r=(function(a){switch(a){case or:case zc:return{byteLength:1,components:1};case oa:case Gc:case la:return{byteLength:2,components:1};case cl:case hl:return{byteLength:2,components:4};case ui:case ll:case Xn:return{byteLength:4,components:1};case Wc:case Xc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${a}.`)})(n);switch(t){case 1021:return i*e;case ul:case dl:return i*e/r.components*r.byteLength;case 1030:case 1031:return i*e*2/r.components*r.byteLength;case 1022:return i*e*3/r.components*r.byteLength;case jn:case 1033:return i*e*4/r.components*r.byteLength;case 33776:case 33777:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case 33778:case 33779:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case 35841:case 35843:return Math.max(i,16)*Math.max(e,8)/4;case 35840:case 35842:return Math.max(i,8)*Math.max(e,8)/2;case 36196:case 37492:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case 37496:case 37808:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case 37809:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case 37810:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case 37811:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case 37812:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case 37813:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case 37814:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case 37815:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case 37816:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case 37817:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case 37818:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case 37819:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case 37820:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case 37821:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil(i/4)*Math.ceil(e/4)*16;case 36283:case 36284:return Math.ceil(i/4)*Math.ceil(e/4)*8;case 36285:case 36286:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"180"}})),typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="180");function wp(){let i=null,e=!1,t=null,n=null;function r(a,s){t(a,s),n=i.requestAnimationFrame(r)}return{start:function(){e!==!0&&t!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(a){t=a},setContext:function(a){i=a}}}function Ef(i){let e=new WeakMap;return{get:function(t){return t.isInterleavedBufferAttribute&&(t=t.data),e.get(t)},remove:function(t){t.isInterleavedBufferAttribute&&(t=t.data);let n=e.get(t);n&&(i.deleteBuffer(n.buffer),e.delete(t))},update:function(t,n){if(t.isInterleavedBufferAttribute&&(t=t.data),t.isGLBufferAttribute){let a=e.get(t);return void((!a||a.version<t.version)&&e.set(t,{buffer:t.buffer,type:t.type,bytesPerElement:t.elementSize,version:t.version}))}let r=e.get(t);if(r===void 0)e.set(t,(function(a,s){let o=a.array,c=a.usage,l=o.byteLength,h=i.createBuffer(),u;if(i.bindBuffer(s,h),i.bufferData(s,o,c),a.onUploadCallback(),o instanceof Float32Array)u=i.FLOAT;else if(typeof Float16Array<"u"&&o instanceof Float16Array)u=i.HALF_FLOAT;else if(o instanceof Uint16Array)u=a.isFloat16BufferAttribute?i.HALF_FLOAT:i.UNSIGNED_SHORT;else if(o instanceof Int16Array)u=i.SHORT;else if(o instanceof Uint32Array)u=i.UNSIGNED_INT;else if(o instanceof Int32Array)u=i.INT;else if(o instanceof Int8Array)u=i.BYTE;else if(o instanceof Uint8Array)u=i.UNSIGNED_BYTE;else{if(!(o instanceof Uint8ClampedArray))throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+o);u=i.UNSIGNED_BYTE}return{buffer:h,type:u,bytesPerElement:o.BYTES_PER_ELEMENT,version:a.version,size:l}})(t,n));else if(r.version<t.version){if(r.size!==t.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");(function(a,s,o){let c=s.array,l=s.updateRanges;if(i.bindBuffer(o,a),l.length===0)i.bufferSubData(o,0,c);else{l.sort((u,d)=>u.start-d.start);let h=0;for(let u=1;u<l.length;u++){let d=l[h],p=l[u];p.start<=d.start+d.count+1?d.count=Math.max(d.count,p.start+p.count-d.start):(++h,l[h]=p)}l.length=h+1;for(let u=0,d=l.length;u<d;u++){let p=l[u];i.bufferSubData(o,p.start*c.BYTES_PER_ELEMENT,c,p.start,p.count)}s.clearUpdateRanges()}s.onUploadCallback()})(r.buffer,t,n),r.version=t.version}}}}var Je={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:"gl_FragColor = linearToOutputTexel( gl_FragColor );",colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distanceRGBA_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distanceRGBA_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},_e={common:{diffuse:{value:new ke(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new qe}},envmap:{envMap:{value:null},envMapRotation:{value:new qe},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new qe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new qe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new qe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new qe},normalScale:{value:new oe(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new qe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new qe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new qe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new qe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ke(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ke(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0},uvTransform:{value:new qe}},sprite:{diffuse:{value:new ke(16777215)},opacity:{value:1},center:{value:new oe(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new qe},alphaMap:{value:null},alphaMapTransform:{value:new qe},alphaTest:{value:0}}},lr={basic:{uniforms:en([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.fog]),vertexShader:Je.meshbasic_vert,fragmentShader:Je.meshbasic_frag},lambert:{uniforms:en([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,_e.lights,{emissive:{value:new ke(0)}}]),vertexShader:Je.meshlambert_vert,fragmentShader:Je.meshlambert_frag},phong:{uniforms:en([_e.common,_e.specularmap,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,_e.lights,{emissive:{value:new ke(0)},specular:{value:new ke(1118481)},shininess:{value:30}}]),vertexShader:Je.meshphong_vert,fragmentShader:Je.meshphong_frag},standard:{uniforms:en([_e.common,_e.envmap,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.roughnessmap,_e.metalnessmap,_e.fog,_e.lights,{emissive:{value:new ke(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Je.meshphysical_vert,fragmentShader:Je.meshphysical_frag},toon:{uniforms:en([_e.common,_e.aomap,_e.lightmap,_e.emissivemap,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.gradientmap,_e.fog,_e.lights,{emissive:{value:new ke(0)}}]),vertexShader:Je.meshtoon_vert,fragmentShader:Je.meshtoon_frag},matcap:{uniforms:en([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,_e.fog,{matcap:{value:null}}]),vertexShader:Je.meshmatcap_vert,fragmentShader:Je.meshmatcap_frag},points:{uniforms:en([_e.points,_e.fog]),vertexShader:Je.points_vert,fragmentShader:Je.points_frag},dashed:{uniforms:en([_e.common,_e.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Je.linedashed_vert,fragmentShader:Je.linedashed_frag},depth:{uniforms:en([_e.common,_e.displacementmap]),vertexShader:Je.depth_vert,fragmentShader:Je.depth_frag},normal:{uniforms:en([_e.common,_e.bumpmap,_e.normalmap,_e.displacementmap,{opacity:{value:1}}]),vertexShader:Je.meshnormal_vert,fragmentShader:Je.meshnormal_frag},sprite:{uniforms:en([_e.sprite,_e.fog]),vertexShader:Je.sprite_vert,fragmentShader:Je.sprite_frag},background:{uniforms:{uvTransform:{value:new qe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Je.background_vert,fragmentShader:Je.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new qe}},vertexShader:Je.backgroundCube_vert,fragmentShader:Je.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Je.cube_vert,fragmentShader:Je.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Je.equirect_vert,fragmentShader:Je.equirect_frag},distanceRGBA:{uniforms:en([_e.common,_e.displacementmap,{referencePosition:{value:new M},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Je.distanceRGBA_vert,fragmentShader:Je.distanceRGBA_frag},shadow:{uniforms:en([_e.lights,_e.fog,{color:{value:new ke(0)},opacity:{value:1}}]),vertexShader:Je.shadow_vert,fragmentShader:Je.shadow_frag}};lr.physical={uniforms:en([lr.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new qe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new qe},clearcoatNormalScale:{value:new oe(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new qe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new qe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new qe},sheen:{value:0},sheenColor:{value:new ke(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new qe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new qe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new qe},transmissionSamplerSize:{value:new oe},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new qe},attenuationDistance:{value:0},attenuationColor:{value:new ke(0)},specularColor:{value:new ke(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new qe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new qe},anisotropyVector:{value:new oe},anisotropyMap:{value:null},anisotropyMapTransform:{value:new qe}}]),vertexShader:Je.meshphysical_vert,fragmentShader:Je.meshphysical_frag};var yl={r:0,b:0,g:0},fi=new Pn,Mf=new Ke;function bf(i,e,t,n,r,a,s){let o=new ke(0),c,l,h=a===!0?0:1,u=null,d=0,p=null;function f(m){let g=m.isScene===!0?m.background:null;return g&&g.isTexture&&(g=(m.backgroundBlurriness>0?t:e).get(g)),g}function _(m,g){m.getRGB(yl,Th(i)),n.buffers.color.setClear(yl.r,yl.g,yl.b,g,s)}return{getClearColor:function(){return o},setClearColor:function(m,g=1){o.set(m),h=g,_(o,h)},getClearAlpha:function(){return h},setClearAlpha:function(m){h=m,_(o,h)},render:function(m){let g=!1,y=f(m);y===null?_(o,h):y&&y.isColor&&(_(y,1),g=!0);let x=i.xr.getEnvironmentBlendMode();x==="additive"?n.buffers.color.setClear(0,0,0,1,s):x==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,s),(i.autoClear||g)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))},addToRenderList:function(m,g){let y=f(g);y&&(y.isCubeTexture||y.mapping===_s)?(l===void 0&&(l=new Bt(new En(1,1,1),new Wn({name:"BackgroundCubeMaterial",uniforms:mi(lr.backgroundCube.uniforms),vertexShader:lr.backgroundCube.vertexShader,fragmentShader:lr.backgroundCube.fragmentShader,side:bn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),l.geometry.deleteAttribute("uv"),l.onBeforeRender=function(x,b,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),fi.copy(g.backgroundRotation),fi.x*=-1,fi.y*=-1,fi.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(fi.y*=-1,fi.z*=-1),l.material.uniforms.envMap.value=y,l.material.uniforms.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,l.material.uniforms.backgroundBlurriness.value=g.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=g.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Mf.makeRotationFromEuler(fi)),l.material.toneMapped=st.getTransfer(y.colorSpace)!==vt,u===y&&d===y.version&&p===i.toneMapping||(l.material.needsUpdate=!0,u=y,d=y.version,p=i.toneMapping),l.layers.enableAll(),m.unshift(l,l.geometry,l.material,0,0,null)):y&&y.isTexture&&(c===void 0&&(c=new Bt(new ta(2,2),new Wn({name:"BackgroundMaterial",uniforms:mi(lr.background.uniforms),vertexShader:lr.background.vertexShader,fragmentShader:lr.background.fragmentShader,side:ia,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=y,c.material.uniforms.backgroundIntensity.value=g.backgroundIntensity,c.material.toneMapped=st.getTransfer(y.colorSpace)!==vt,y.matrixAutoUpdate===!0&&y.updateMatrix(),c.material.uniforms.uvTransform.value.copy(y.matrix),u===y&&d===y.version&&p===i.toneMapping||(c.material.needsUpdate=!0,u=y,d=y.version,p=i.toneMapping),c.layers.enableAll(),m.unshift(c,c.geometry,c.material,0,0,null))},dispose:function(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}}}function Sf(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},r=l(null),a=r,s=!1;function o(g){return i.bindVertexArray(g)}function c(g){return i.deleteVertexArray(g)}function l(g){let y=[],x=[],b=[];for(let L=0;L<t;L++)y[L]=0,x[L]=0,b[L]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:y,enabledAttributes:x,attributeDivisors:b,object:g,attributes:{},index:null}}function h(){let g=a.newAttributes;for(let y=0,x=g.length;y<x;y++)g[y]=0}function u(g){d(g,0)}function d(g,y){let x=a.newAttributes,b=a.enabledAttributes,L=a.attributeDivisors;x[g]=1,b[g]===0&&(i.enableVertexAttribArray(g),b[g]=1),L[g]!==y&&(i.vertexAttribDivisor(g,y),L[g]=y)}function p(){let g=a.newAttributes,y=a.enabledAttributes;for(let x=0,b=y.length;x<b;x++)y[x]!==g[x]&&(i.disableVertexAttribArray(x),y[x]=0)}function f(g,y,x,b,L,I,B){B===!0?i.vertexAttribIPointer(g,y,x,L,I):i.vertexAttribPointer(g,y,x,b,L,I)}function _(){m(),s=!0,a!==r&&(a=r,o(a.object))}function m(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:function(g,y,x,b,L){let I=!1,B=(function(G,F,j){let K=j.wireframe===!0,z=n[G.id];z===void 0&&(z={},n[G.id]=z);let Z=z[F.id];Z===void 0&&(Z={},z[F.id]=Z);let X=Z[K];return X===void 0&&(X=l(i.createVertexArray()),Z[K]=X),X})(b,x,y);a!==B&&(a=B,o(a.object)),I=(function(G,F,j,K){let z=a.attributes,Z=F.attributes,X=0,Q=j.getAttributes();for(let ie in Q)if(Q[ie].location>=0){let pe=z[ie],ae=Z[ie];if(ae===void 0&&(ie==="instanceMatrix"&&G.instanceMatrix&&(ae=G.instanceMatrix),ie==="instanceColor"&&G.instanceColor&&(ae=G.instanceColor)),pe===void 0||pe.attribute!==ae||ae&&pe.data!==ae.data)return!0;X++}return a.attributesNum!==X||a.index!==K})(g,b,x,L),I&&(function(G,F,j,K){let z={},Z=F.attributes,X=0,Q=j.getAttributes();for(let ie in Q)if(Q[ie].location>=0){let pe=Z[ie];pe===void 0&&(ie==="instanceMatrix"&&G.instanceMatrix&&(pe=G.instanceMatrix),ie==="instanceColor"&&G.instanceColor&&(pe=G.instanceColor));let ae={};ae.attribute=pe,pe&&pe.data&&(ae.data=pe.data),z[ie]=ae,X++}a.attributes=z,a.attributesNum=X,a.index=K})(g,b,x,L),L!==null&&e.update(L,i.ELEMENT_ARRAY_BUFFER),(I||s)&&(s=!1,(function(G,F,j,K){h();let z=K.attributes,Z=j.getAttributes(),X=F.defaultAttributeValues;for(let Q in Z){let ie=Z[Q];if(ie.location>=0){let pe=z[Q];if(pe===void 0&&(Q==="instanceMatrix"&&G.instanceMatrix&&(pe=G.instanceMatrix),Q==="instanceColor"&&G.instanceColor&&(pe=G.instanceColor)),pe!==void 0){let ae=pe.normalized,Se=pe.itemSize,Pe=e.get(pe);if(Pe===void 0)continue;let ve=Pe.buffer,Re=Pe.type,ue=Pe.bytesPerElement,ge=Re===i.INT||Re===i.UNSIGNED_INT||pe.gpuType===ll;if(pe.isInterleavedBufferAttribute){let me=pe.data,De=me.stride,Ve=pe.offset;if(me.isInstancedInterleavedBuffer){for(let w=0;w<ie.locationSize;w++)d(ie.location+w,me.meshPerAttribute);G.isInstancedMesh!==!0&&K._maxInstanceCount===void 0&&(K._maxInstanceCount=me.meshPerAttribute*me.count)}else for(let w=0;w<ie.locationSize;w++)u(ie.location+w);i.bindBuffer(i.ARRAY_BUFFER,ve);for(let w=0;w<ie.locationSize;w++)f(ie.location+w,Se/ie.locationSize,Re,ae,De*ue,(Ve+Se/ie.locationSize*w)*ue,ge)}else{if(pe.isInstancedBufferAttribute){for(let me=0;me<ie.locationSize;me++)d(ie.location+me,pe.meshPerAttribute);G.isInstancedMesh!==!0&&K._maxInstanceCount===void 0&&(K._maxInstanceCount=pe.meshPerAttribute*pe.count)}else for(let me=0;me<ie.locationSize;me++)u(ie.location+me);i.bindBuffer(i.ARRAY_BUFFER,ve);for(let me=0;me<ie.locationSize;me++)f(ie.location+me,Se/ie.locationSize,Re,ae,Se*ue,Se/ie.locationSize*me*ue,ge)}}else if(X!==void 0){let ae=X[Q];if(ae!==void 0)switch(ae.length){case 2:i.vertexAttrib2fv(ie.location,ae);break;case 3:i.vertexAttrib3fv(ie.location,ae);break;case 4:i.vertexAttrib4fv(ie.location,ae);break;default:i.vertexAttrib1fv(ie.location,ae)}}}}p()})(g,y,x,b),L!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(L).buffer))},reset:_,resetDefaultState:m,dispose:function(){_();for(let g in n){let y=n[g];for(let x in y){let b=y[x];for(let L in b)c(b[L].object),delete b[L];delete y[x]}delete n[g]}},releaseStatesOfGeometry:function(g){if(n[g.id]===void 0)return;let y=n[g.id];for(let x in y){let b=y[x];for(let L in b)c(b[L].object),delete b[L];delete y[x]}delete n[g.id]},releaseStatesOfProgram:function(g){for(let y in n){let x=n[y];if(x[g.id]===void 0)continue;let b=x[g.id];for(let L in b)c(b[L].object),delete b[L];delete x[g.id]}},initAttributes:h,enableAttribute:u,disableUnusedAttributes:p}}function Tf(i,e,t){let n;function r(a,s,o){o!==0&&(i.drawArraysInstanced(n,a,s,o),t.update(s,n,o))}this.setMode=function(a){n=a},this.render=function(a,s){i.drawArrays(n,a,s),t.update(s,n,1)},this.renderInstances=r,this.renderMultiDraw=function(a,s,o){if(o===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,a,0,s,0,o);let c=0;for(let l=0;l<o;l++)c+=s[l];t.update(c,n,1)},this.renderMultiDrawInstances=function(a,s,o,c){if(o===0)return;let l=e.get("WEBGL_multi_draw");if(l===null)for(let h=0;h<a.length;h++)r(a[h],s[h],c[h]);else{l.multiDrawArraysInstancedWEBGL(n,a,0,s,0,c,0,o);let h=0;for(let u=0;u<o;u++)h+=s[u]*c[u];t.update(h,n,1)}}}function wf(i,e,t,n){let r;function a(d){if(d==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";d="mediump"}return d==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let s=t.precision!==void 0?t.precision:"highp",o=a(s);o!==s&&(console.warn("THREE.WebGLRenderer:",s,"not supported, using",o,"instead."),s=o);let c=t.logarithmicDepthBuffer===!0,l=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),h=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),u=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS);return{isWebGL2:!0,getMaxAnisotropy:function(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let d=e.get("EXT_texture_filter_anisotropic");r=i.getParameter(d.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r},getMaxPrecision:a,textureFormatReadable:function(d){return d===jn||n.convert(d)===i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT)},textureTypeReadable:function(d){let p=d===la&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(d!==or&&n.convert(d)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&d!==Xn&&!p)},precision:s,logarithmicDepthBuffer:c,reversedDepthBuffer:l,maxTextures:h,maxVertexTextures:u,maxTextureSize:i.getParameter(i.MAX_TEXTURE_SIZE),maxCubemapSize:i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),maxAttributes:i.getParameter(i.MAX_VERTEX_ATTRIBS),maxVertexUniforms:i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),maxVaryings:i.getParameter(i.MAX_VARYING_VECTORS),maxFragmentUniforms:i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),vertexTextures:u>0,maxSamples:i.getParameter(i.MAX_SAMPLES)}}function Af(i){let e=this,t=null,n=0,r=!1,a=!1,s=new Cn,o=new qe,c={value:null,needsUpdate:!1};function l(h,u,d,p){let f=h!==null?h.length:0,_=null;if(f!==0){if(_=c.value,p!==!0||_===null){let m=d+4*f,g=u.matrixWorldInverse;o.getNormalMatrix(g),(_===null||_.length<m)&&(_=new Float32Array(m));for(let y=0,x=d;y!==f;++y,x+=4)s.copy(h[y]).applyMatrix4(g,o),s.normal.toArray(_,x),_[x+3]=s.constant}c.value=_,c.needsUpdate=!0}return e.numPlanes=f,e.numIntersection=0,_}this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(h,u){let d=h.length!==0||u||n!==0||r;return r=u,n=h.length,d},this.beginShadows=function(){a=!0,l(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(h,u){t=l(h,u,0)},this.setState=function(h,u,d){let p=h.clippingPlanes,f=h.clipIntersection,_=h.clipShadows,m=i.get(h);if(!r||p===null||p.length===0||a&&!_)a?l(null):(function(){c.value!==t&&(c.value=t,c.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0})();else{let g=a?0:n,y=4*g,x=m.clippingState||null;c.value=x,x=l(p,u,y,d);for(let b=0;b!==y;++b)x[b]=t[b];m.clippingState=x,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=g}}}function Rf(i){let e=new WeakMap;function t(r,a){return a===al?r.mapping=sa:a===sl&&(r.mapping=ci),r}function n(r){let a=r.target;a.removeEventListener("dispose",n);let s=e.get(a);s!==void 0&&(e.delete(a),s.dispose())}return{get:function(r){if(r&&r.isTexture){let a=r.mapping;if(a===al||a===sl){if(e.has(r))return t(e.get(r).texture,r.mapping);{let s=r.image;if(s&&s.height>0){let o=new vo(s.height);return o.fromEquirectangularTexture(i,r),e.set(r,o),r.addEventListener("dispose",n),t(o.texture,r.mapping)}return null}}}return r},dispose:function(){e=new WeakMap}}}var rp=[.125,.215,.35,.446,.526,.582],bs=20,Ch=new ds,ip=new ke,Ih=null,Lh=0,Ph=0,Dh=!1,yi=(1+Math.sqrt(5))/2,ha=1/yi,ap=[new M(-yi,ha,0),new M(yi,ha,0),new M(-ha,0,yi),new M(ha,0,yi),new M(0,yi,-ha),new M(0,yi,ha),new M(-1,1,-1),new M(1,1,-1),new M(-1,1,1),new M(1,1,1)],Cf=new M,xl=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,n=.1,r=100,a={}){let{size:s=256,position:o=Cf}=a;Ih=this._renderer.getRenderTarget(),Lh=this._renderer.getActiveCubeFace(),Ph=this._renderer.getActiveMipmapLevel(),Dh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(s);let c=this._allocateTargets();return c.depthBuffer=!0,this._sceneToCubeUV(e,n,r,c,o),t>0&&this._blur(c,0,0,t),this._applyPMREM(c),this._cleanup(c),c}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=lp(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=op(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Ih,Lh,Ph),this._renderer.xr.enabled=Dh,e.scissorTest=!1,vl(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===sa||e.mapping===ci?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Ih=this._renderer.getRenderTarget(),Lh=this._renderer.getActiveCubeFace(),Ph=this._renderer.getActiveMipmapLevel(),Dh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:er,minFilter:er,generateMipmaps:!1,type:la,format:jn,colorSpace:ti,depthBuffer:!1},r=sp(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=sp(e,t,n);let{_lodMax:a}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=(function(s){let o=[],c=[],l=[],h=s,u=s-4+1+rp.length;for(let d=0;d<u;d++){let p=Math.pow(2,h);c.push(p);let f=1/p;d>s-4?f=rp[d-s+4-1]:d===0&&(f=0),l.push(f);let _=1/(p-2),m=-_,g=1+_,y=[m,m,g,m,g,g,m,m,g,g,m,g],x=6,b=6,L=3,I=2,B=1,G=new Float32Array(L*b*x),F=new Float32Array(I*b*x),j=new Float32Array(B*b*x);for(let z=0;z<x;z++){let Z=z%3*2/3-1,X=z>2?0:-1,Q=[Z,X,0,Z+2/3,X,0,Z+2/3,X+1,0,Z,X,0,Z+2/3,X+1,0,Z,X+1,0];G.set(Q,L*b*z),F.set(y,I*b*z);let ie=[z,z,z,z,z,z];j.set(ie,B*b*z)}let K=new tt;K.setAttribute("position",new Nt(G,L)),K.setAttribute("uv",new Nt(F,I)),K.setAttribute("faceIndex",new Nt(j,B)),o.push(K),h>4&&h--}return{lodPlanes:o,sizeLods:c,sigmas:l}})(a)),this._blurMaterial=(function(s,o,c){let l=new Float32Array(bs),h=new M(0,1,0);return new Wn({name:"SphericalGaussianBlur",defines:{n:bs,CUBEUV_TEXEL_WIDTH:1/o,CUBEUV_TEXEL_HEIGHT:1/c,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:l},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:h}},vertexShader:Gh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})})(a,e,t)}return r}_compileMaterial(e){let t=new Bt(this._lodPlanes[0],e);this._renderer.compile(t,Ch)}_sceneToCubeUV(e,t,n,r,a){let s=new Qt(90,1,t,n),o=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],l=this._renderer,h=l.autoClear,u=l.toneMapping;l.getClearColor(ip),l.toneMapping=vr,l.autoClear=!1,l.state.buffers.depth.getReversed()&&(l.setRenderTarget(r),l.clearDepth(),l.setRenderTarget(null));let d=new xn({name:"PMREM.Background",side:bn,depthWrite:!1,depthTest:!1}),p=new Bt(new En,d),f=!1,_=e.background;_?_.isColor&&(d.color.copy(_),e.background=null,f=!0):(d.color.copy(ip),f=!0);for(let m=0;m<6;m++){let g=m%3;g===0?(s.up.set(0,o[m],0),s.position.set(a.x,a.y,a.z),s.lookAt(a.x+c[m],a.y,a.z)):g===1?(s.up.set(0,0,o[m]),s.position.set(a.x,a.y,a.z),s.lookAt(a.x,a.y+c[m],a.z)):(s.up.set(0,o[m],0),s.position.set(a.x,a.y,a.z),s.lookAt(a.x,a.y,a.z+c[m]));let y=this._cubeSize;vl(r,g*y,m>2?y:0,y,y),l.setRenderTarget(r),f&&l.render(p,s),l.render(e,s)}p.geometry.dispose(),p.material.dispose(),l.toneMapping=u,l.autoClear=h,e.background=_}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===sa||e.mapping===ci;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=lp()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=op());let a=r?this._cubemapMaterial:this._equirectMaterial,s=new Bt(this._lodPlanes[0],a);a.uniforms.envMap.value=e;let o=this._cubeSize;vl(t,0,0,3*o,2*o),n.setRenderTarget(t),n.render(s,Ch)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodPlanes.length;for(let a=1;a<r;a++){let s=Math.sqrt(this._sigmas[a]*this._sigmas[a]-this._sigmas[a-1]*this._sigmas[a-1]),o=ap[(r-a-1)%ap.length];this._blur(e,a-1,a,s,o)}t.autoClear=n}_blur(e,t,n,r,a){let s=this._pingPongRenderTarget;this._halfBlur(e,s,t,n,r,"latitudinal",a),this._halfBlur(s,e,n,n,r,"longitudinal",a)}_halfBlur(e,t,n,r,a,s,o){let c=this._renderer,l=this._blurMaterial;s!=="latitudinal"&&s!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");let h=new Bt(this._lodPlanes[r],l),u=l.uniforms,d=this._sizeLods[n]-1,p=isFinite(a)?Math.PI/(2*d):2*Math.PI/39,f=a/p,_=isFinite(a)?1+Math.floor(3*f):bs;_>bs&&console.warn(`sigmaRadians, ${a}, is too large and will clip, as it requested ${_} samples when the maximum is set to 20`);let m=[],g=0;for(let b=0;b<bs;++b){let L=b/f,I=Math.exp(-L*L/2);m.push(I),b===0?g+=I:b<_&&(g+=2*I)}for(let b=0;b<m.length;b++)m[b]=m[b]/g;u.envMap.value=e.texture,u.samples.value=_,u.weights.value=m,u.latitudinal.value=s==="latitudinal",o&&(u.poleAxis.value=o);let{_lodMax:y}=this;u.dTheta.value=p,u.mipInt.value=y-n;let x=this._sizeLods[r];vl(t,3*x*(r>y-4?r-y+4:0),4*(this._cubeSize-x),3*x,2*x),c.setRenderTarget(t),c.render(h,Ch)}};function sp(i,e,t){let n=new nr(i,e,t);return n.texture.mapping=_s,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function vl(i,e,t,n,r){i.viewport.set(e,t,n,r),i.scissor.set(e,t,n,r)}function op(){return new Wn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Gh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})}function lp(){return new Wn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Gh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Fr,depthTest:!1,depthWrite:!1})}function Gh(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function If(i){let e=new WeakMap,t=null;function n(r){let a=r.target;a.removeEventListener("dispose",n);let s=e.get(a);s!==void 0&&(e.delete(a),s.dispose())}return{get:function(r){if(r&&r.isTexture){let a=r.mapping,s=a===al||a===sl,o=a===sa||a===ci;if(s||o){let c=e.get(r),l=c!==void 0?c.texture.pmremVersion:0;if(r.isRenderTargetTexture&&r.pmremVersion!==l)return t===null&&(t=new xl(i)),c=s?t.fromEquirectangular(r,c):t.fromCubemap(r,c),c.texture.pmremVersion=r.pmremVersion,e.set(r,c),c.texture;if(c!==void 0)return c.texture;{let h=r.image;return s&&h&&h.height>0||o&&h&&(function(u){let d=0,p=6;for(let f=0;f<p;f++)u[f]!==void 0&&d++;return d===p})(h)?(t===null&&(t=new xl(i)),c=s?t.fromEquirectangular(r):t.fromCubemap(r),c.texture.pmremVersion=r.pmremVersion,e.set(r,c),r.addEventListener("dispose",n),c.texture):null}}}return r},dispose:function(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}}}function Lf(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let r;switch(n){case"WEBGL_depth_texture":r=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=i.getExtension(n)}return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let r=t(n);return r===null&&ji("THREE.WebGLRenderer: "+n+" extension not supported."),r}}}function Pf(i,e,t,n){let r={},a=new WeakMap;function s(c){let l=c.target;l.index!==null&&e.remove(l.index);for(let u in l.attributes)e.remove(l.attributes[u]);l.removeEventListener("dispose",s),delete r[l.id];let h=a.get(l);h&&(e.remove(h),a.delete(l)),n.releaseStatesOfGeometry(l),l.isInstancedBufferGeometry===!0&&delete l._maxInstanceCount,t.memory.geometries--}function o(c){let l=[],h=c.index,u=c.attributes.position,d=0;if(h!==null){let _=h.array;d=h.version;for(let m=0,g=_.length;m<g;m+=3){let y=_[m+0],x=_[m+1],b=_[m+2];l.push(y,x,x,b,b,y)}}else{if(u===void 0)return;{let _=u.array;d=u.version;for(let m=0,g=_.length/3-1;m<g;m+=3){let y=m+0,x=m+1,b=m+2;l.push(y,x,x,b,b,y)}}}let p=new(Sh(l)?Xa:Wa)(l,1);p.version=d;let f=a.get(c);f&&e.remove(f),a.set(c,p)}return{get:function(c,l){return r[l.id]===!0||(l.addEventListener("dispose",s),r[l.id]=!0,t.memory.geometries++),l},update:function(c){let l=c.attributes;for(let h in l)e.update(l[h],i.ARRAY_BUFFER)},getWireframeAttribute:function(c){let l=a.get(c);if(l){let h=c.index;h!==null&&l.version<h.version&&o(c)}else o(c);return a.get(c)}}}function Df(i,e,t){let n,r,a;function s(o,c,l){l!==0&&(i.drawElementsInstanced(n,c,r,o*a,l),t.update(c,n,l))}this.setMode=function(o){n=o},this.setIndex=function(o){r=o.type,a=o.bytesPerElement},this.render=function(o,c){i.drawElements(n,c,r,o*a),t.update(c,n,1)},this.renderInstances=s,this.renderMultiDraw=function(o,c,l){if(l===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,c,0,r,o,0,l);let h=0;for(let u=0;u<l;u++)h+=c[u];t.update(h,n,1)},this.renderMultiDrawInstances=function(o,c,l,h){if(l===0)return;let u=e.get("WEBGL_multi_draw");if(u===null)for(let d=0;d<o.length;d++)s(o[d]/a,c[d],h[d]);else{u.multiDrawElementsInstancedWEBGL(n,c,0,r,o,0,h,0,l);let d=0;for(let p=0;p<l;p++)d+=c[p]*h[p];t.update(d,n,1)}}}function Nf(i){let e={frame:0,calls:0,triangles:0,points:0,lines:0};return{memory:{geometries:0,textures:0},render:e,programs:null,autoReset:!0,reset:function(){e.calls=0,e.triangles=0,e.points=0,e.lines=0},update:function(t,n,r){switch(e.calls++,n){case i.TRIANGLES:e.triangles+=r*(t/3);break;case i.LINES:e.lines+=r*(t/2);break;case i.LINE_STRIP:e.lines+=r*(t-1);break;case i.LINE_LOOP:e.lines+=r*t;break;case i.POINTS:e.points+=r*t;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",n)}}}}function Uf(i,e,t){let n=new WeakMap,r=new Rt;return{update:function(a,s,o){let c=a.morphTargetInfluences,l=s.morphAttributes.position||s.morphAttributes.normal||s.morphAttributes.color,h=l!==void 0?l.length:0,u=n.get(s);if(u===void 0||u.count!==h){let G=function(){I.dispose(),n.delete(s),s.removeEventListener("dispose",G)};u!==void 0&&u.texture.dispose();let d=s.morphAttributes.position!==void 0,p=s.morphAttributes.normal!==void 0,f=s.morphAttributes.color!==void 0,_=s.morphAttributes.position||[],m=s.morphAttributes.normal||[],g=s.morphAttributes.color||[],y=0;d===!0&&(y=1),p===!0&&(y=2),f===!0&&(y=3);let x=s.attributes.position.count*y,b=1;x>e.maxTextureSize&&(b=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);let L=new Float32Array(x*b*4*h),I=new Ga(L,x,b,h);I.type=Xn,I.needsUpdate=!0;let B=4*y;for(let F=0;F<h;F++){let j=_[F],K=m[F],z=g[F],Z=x*b*4*F;for(let X=0;X<j.count;X++){let Q=X*B;d===!0&&(r.fromBufferAttribute(j,X),L[Z+Q+0]=r.x,L[Z+Q+1]=r.y,L[Z+Q+2]=r.z,L[Z+Q+3]=0),p===!0&&(r.fromBufferAttribute(K,X),L[Z+Q+4]=r.x,L[Z+Q+5]=r.y,L[Z+Q+6]=r.z,L[Z+Q+7]=0),f===!0&&(r.fromBufferAttribute(z,X),L[Z+Q+8]=r.x,L[Z+Q+9]=r.y,L[Z+Q+10]=r.z,L[Z+Q+11]=z.itemSize===4?r.w:1)}}u={count:h,texture:I,size:new oe(x,b)},n.set(s,u),s.addEventListener("dispose",G)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)o.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let d=0;for(let f=0;f<c.length;f++)d+=c[f];let p=s.morphTargetsRelative?1:1-d;o.getUniforms().setValue(i,"morphTargetBaseInfluence",p),o.getUniforms().setValue(i,"morphTargetInfluences",c)}o.getUniforms().setValue(i,"morphTargetsTexture",u.texture,t),o.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}}}function Of(i,e,t,n){let r=new WeakMap;function a(s){let o=s.target;o.removeEventListener("dispose",a),t.remove(o.instanceMatrix),o.instanceColor!==null&&t.remove(o.instanceColor)}return{update:function(s){let o=n.render.frame,c=s.geometry,l=e.get(s,c);if(r.get(l)!==o&&(e.update(l),r.set(l,o)),s.isInstancedMesh&&(s.hasEventListener("dispose",a)===!1&&s.addEventListener("dispose",a),r.get(s)!==o&&(t.update(s.instanceMatrix,i.ARRAY_BUFFER),s.instanceColor!==null&&t.update(s.instanceColor,i.ARRAY_BUFFER),r.set(s,o))),s.isSkinnedMesh){let h=s.skeleton;r.get(h)!==o&&(h.update(),r.set(h,o))}return l},dispose:function(){r=new WeakMap}}}var Ap=new un,cp=new Za(1,1),Rp=new Ga,Cp=new go,Ip=new ja,hp=[],up=[],dp=new Float32Array(16),pp=new Float32Array(9),mp=new Float32Array(4);function da(i,e,t){let n=i[0];if(n<=0||n>0)return i;let r=e*t,a=hp[r];if(a===void 0&&(a=new Float32Array(r),hp[r]=a),e!==0){n.toArray(a,0);for(let s=1,o=0;s!==e;++s)o+=t,i[s].toArray(a,o)}return a}function zt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Gt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ml(i,e){let t=up[e];t===void 0&&(t=new Int32Array(e),up[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function Bf(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function Ff(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2fv(this.addr,e),Gt(t,e)}}function kf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)t[0]===e.r&&t[1]===e.g&&t[2]===e.b||(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(zt(t,e))return;i.uniform3fv(this.addr,e),Gt(t,e)}}function Hf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4fv(this.addr,e),Gt(t,e)}}function Vf(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Gt(t,e)}else{if(zt(t,n))return;mp.set(n),i.uniformMatrix2fv(this.addr,!1,mp),Gt(t,n)}}function zf(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Gt(t,e)}else{if(zt(t,n))return;pp.set(n),i.uniformMatrix3fv(this.addr,!1,pp),Gt(t,n)}}function Gf(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(zt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Gt(t,e)}else{if(zt(t,n))return;dp.set(n),i.uniformMatrix4fv(this.addr,!1,dp),Gt(t,n)}}function Wf(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Xf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2iv(this.addr,e),Gt(t,e)}}function jf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;i.uniform3iv(this.addr,e),Gt(t,e)}}function qf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4iv(this.addr,e),Gt(t,e)}}function Yf(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Kf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y||(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;i.uniform2uiv(this.addr,e),Gt(t,e)}}function Zf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z||(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;i.uniform3uiv(this.addr,e),Gt(t,e)}}function Jf(i,e){let t=this.cache;if(e.x!==void 0)t[0]===e.x&&t[1]===e.y&&t[2]===e.z&&t[3]===e.w||(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;i.uniform4uiv(this.addr,e),Gt(t,e)}}function $f(i,e,t){let n=this.cache,r=t.allocateTextureUnit(),a;n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),this.type===i.SAMPLER_2D_SHADOW?(cp.compareFunction=Mh,a=cp):a=Ap,t.setTexture2D(e||a,r)}function Qf(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||Cp,r)}function eg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTextureCube(e||Ip,r)}function tg(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||Rp,r)}function ng(i,e){i.uniform1fv(this.addr,e)}function rg(i,e){let t=da(e,this.size,2);i.uniform2fv(this.addr,t)}function ig(i,e){let t=da(e,this.size,3);i.uniform3fv(this.addr,t)}function ag(i,e){let t=da(e,this.size,4);i.uniform4fv(this.addr,t)}function sg(i,e){let t=da(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function og(i,e){let t=da(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function lg(i,e){let t=da(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function cg(i,e){i.uniform1iv(this.addr,e)}function hg(i,e){i.uniform2iv(this.addr,e)}function ug(i,e){i.uniform3iv(this.addr,e)}function dg(i,e){i.uniform4iv(this.addr,e)}function pg(i,e){i.uniform1uiv(this.addr,e)}function mg(i,e){i.uniform2uiv(this.addr,e)}function fg(i,e){i.uniform3uiv(this.addr,e)}function gg(i,e){i.uniform4uiv(this.addr,e)}function yg(i,e,t){let n=this.cache,r=e.length,a=Ml(t,r);zt(n,a)||(i.uniform1iv(this.addr,a),Gt(n,a));for(let s=0;s!==r;++s)t.setTexture2D(e[s]||Ap,a[s])}function vg(i,e,t){let n=this.cache,r=e.length,a=Ml(t,r);zt(n,a)||(i.uniform1iv(this.addr,a),Gt(n,a));for(let s=0;s!==r;++s)t.setTexture3D(e[s]||Cp,a[s])}function _g(i,e,t){let n=this.cache,r=e.length,a=Ml(t,r);zt(n,a)||(i.uniform1iv(this.addr,a),Gt(n,a));for(let s=0;s!==r;++s)t.setTextureCube(e[s]||Ip,a[s])}function xg(i,e,t){let n=this.cache,r=e.length,a=Ml(t,r);zt(n,a)||(i.uniform1iv(this.addr,a),Gt(n,a));for(let s=0;s!==r;++s)t.setTexture2DArray(e[s]||Rp,a[s])}var Uh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=(function(r){switch(r){case 5126:return Bf;case 35664:return Ff;case 35665:return kf;case 35666:return Hf;case 35674:return Vf;case 35675:return zf;case 35676:return Gf;case 5124:case 35670:return Wf;case 35667:case 35671:return Xf;case 35668:case 35672:return jf;case 35669:case 35673:return qf;case 5125:return Yf;case 36294:return Kf;case 36295:return Zf;case 36296:return Jf;case 35678:case 36198:case 36298:case 36306:case 35682:return $f;case 35679:case 36299:case 36307:return Qf;case 35680:case 36300:case 36308:case 36293:return eg;case 36289:case 36303:case 36311:case 36292:return tg}})(t.type)}},Oh=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=(function(r){switch(r){case 5126:return ng;case 35664:return rg;case 35665:return ig;case 35666:return ag;case 35674:return sg;case 35675:return og;case 35676:return lg;case 5124:case 35670:return cg;case 35667:case 35671:return hg;case 35668:case 35672:return ug;case 35669:case 35673:return dg;case 5125:return pg;case 36294:return mg;case 36295:return fg;case 36296:return gg;case 35678:case 36198:case 36298:case 36306:case 35682:return yg;case 35679:case 36299:case 36307:return vg;case 35680:case 36300:case 36308:case 36293:return _g;case 36289:case 36303:case 36311:case 36292:return xg}})(t.type)}},Bh=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let a=0,s=r.length;a!==s;++a){let o=r[a];o.setValue(e,t[o.id],n)}}},Nh=/(\w+)(\])?(\[|\.)?/g;function fp(i,e){i.seq.push(e),i.map[e.id]=e}function Eg(i,e,t){let n=i.name,r=n.length;for(Nh.lastIndex=0;;){let a=Nh.exec(n),s=Nh.lastIndex,o=a[1],c=a[2]==="]",l=a[3];if(c&&(o|=0),l===void 0||l==="["&&s+2===r){fp(t,l===void 0?new Uh(o,i,e):new Oh(o,i,e));break}{let h=t.map[o];h===void 0&&(h=new Bh(o),fp(t,h)),t=h}}}var ua=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let a=e.getActiveUniform(t,r);Eg(a,e.getUniformLocation(t,a.name),this)}}setValue(e,t,n,r){let a=this.map[t];a!==void 0&&a.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let a=0,s=t.length;a!==s;++a){let o=t[a],c=n[o.id];c.needsUpdate!==!1&&o.setValue(e,c.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,a=e.length;r!==a;++r){let s=e[r];s.id in t&&n.push(s)}return n}};function gp(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var Mg=0,yp=new qe;function vp(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";let a=/ERROR: 0:(\d+)/.exec(r);if(a){let s=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+(function(o,c){let l=o.split(`
`),h=[],u=Math.max(c-6,0),d=Math.min(c+6,l.length);for(let p=u;p<d;p++){let f=p+1;h.push(`${f===c?">":" "} ${f}: ${l[p]}`)}return h.join(`
`)})(i.getShaderSource(e),s)}return r}function bg(i,e){let t=(function(n){st._getMatrix(yp,st.workingColorSpace,n);let r=`mat3( ${yp.elements.map(a=>a.toFixed(4))} )`;switch(st.getTransfer(n)){case Ha:return[r,"LinearTransferOETF"];case vt:return[r,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[r,"LinearTransferOETF"]}})(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Sg(i,e){let t;switch(e){case Rd:t="Linear";break;case Cd:t="Reinhard";break;case Id:t="Cineon";break;case Ld:t="ACESFilmic";break;case Dd:t="AgX";break;case Nd:t="Neutral";break;case Pd:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var _l=new M;function Tg(){return st.getLuminanceCoefficients(_l),["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${_l.x.toFixed(4)}, ${_l.y.toFixed(4)}, ${_l.z.toFixed(4)} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Ss(i){return i!==""}function _p(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function xp(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var wg=/^[ \t]*#include +<([\w\d./]+)>/gm;function Fh(i){return i.replace(wg,Rg)}var Ag=new Map;function Rg(i,e){let t=Je[e];if(t===void 0){let n=Ag.get(e);if(n===void 0)throw new Error("Can not resolve #include <"+e+">");t=Je[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n)}return Fh(t)}var Cg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ep(i){return i.replace(Cg,Ig)}function Ig(i,e,t,n){let r="";for(let a=parseInt(e);a<parseInt(t);a++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return r}function Mp(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}function Lg(i,e,t,n){let r=i.getContext(),a=t.defines,s=t.vertexShader,o=t.fragmentShader,c=(function(K){let z="SHADOWMAP_TYPE_BASIC";return K.shadowMapType===Bc?z="SHADOWMAP_TYPE_PCF":K.shadowMapType===id?z="SHADOWMAP_TYPE_PCF_SOFT":K.shadowMapType===sr&&(z="SHADOWMAP_TYPE_VSM"),z})(t),l=(function(K){let z="ENVMAP_TYPE_CUBE";if(K.envMap)switch(K.envMapMode){case sa:case ci:z="ENVMAP_TYPE_CUBE";break;case _s:z="ENVMAP_TYPE_CUBE_UV"}return z})(t),h=(function(K){let z="ENVMAP_MODE_REFLECTION";return K.envMap&&K.envMapMode===ci&&(z="ENVMAP_MODE_REFRACTION"),z})(t),u=(function(K){let z="ENVMAP_BLENDING_NONE";if(K.envMap)switch(K.combine){case Td:z="ENVMAP_BLENDING_MULTIPLY";break;case wd:z="ENVMAP_BLENDING_MIX";break;case Ad:z="ENVMAP_BLENDING_ADD"}return z})(t),d=(function(K){let z=K.envMapCubeUVHeight;if(z===null)return null;let Z=Math.log2(z)-2,X=1/z;return{texelWidth:1/(3*Math.max(Math.pow(2,Z),112)),texelHeight:X,maxMip:Z}})(t),p=(function(K){return[K.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",K.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Ss).join(`
`)})(t),f=(function(K){let z=[];for(let Z in K){let X=K[Z];X!==!1&&z.push("#define "+Z+" "+X)}return z.join(`
`)})(a),_=r.createProgram(),m,g,y=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(Ss).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f].filter(Ss).join(`
`),g.length>0&&(g+=`
`)):(m=[Mp(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Ss).join(`
`),g=[Mp(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,f,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+l:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+c:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==vr?"#define TONE_MAPPING":"",t.toneMapping!==vr?Je.tonemapping_pars_fragment:"",t.toneMapping!==vr?Sg("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Je.colorspace_pars_fragment,bg("linearToOutputTexel",t.outputColorSpace),Tg(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Ss).join(`
`)),s=Fh(s),s=_p(s,t),s=xp(s,t),o=Fh(o),o=_p(o,t),o=xp(o,t),s=Ep(s),o=Ep(o),t.isRawShaderMaterial!==!0&&(y=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",t.glslVersion===bh?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===bh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let x=y+m+s,b=y+g+o,L=gp(r,r.VERTEX_SHADER,x),I=gp(r,r.FRAGMENT_SHADER,b);function B(K){if(i.debug.checkShaderErrors){let z=r.getProgramInfoLog(_)||"",Z=r.getShaderInfoLog(L)||"",X=r.getShaderInfoLog(I)||"",Q=z.trim(),ie=Z.trim(),pe=X.trim(),ae=!0,Se=!0;if(r.getProgramParameter(_,r.LINK_STATUS)===!1)if(ae=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,_,L,I);else{let Pe=vp(r,L,"vertex"),ve=vp(r,I,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(_,r.VALIDATE_STATUS)+`

Material Name: `+K.name+`
Material Type: `+K.type+`

Program Info Log: `+Q+`
`+Pe+`
`+ve)}else Q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",Q):ie!==""&&pe!==""||(Se=!1);Se&&(K.diagnostics={runnable:ae,programLog:Q,vertexShader:{log:ie,prefix:m},fragmentShader:{log:pe,prefix:g}})}r.deleteShader(L),r.deleteShader(I),G=new ua(r,_),F=(function(z,Z){let X={},Q=z.getProgramParameter(Z,z.ACTIVE_ATTRIBUTES);for(let ie=0;ie<Q;ie++){let pe=z.getActiveAttrib(Z,ie),ae=pe.name,Se=1;pe.type===z.FLOAT_MAT2&&(Se=2),pe.type===z.FLOAT_MAT3&&(Se=3),pe.type===z.FLOAT_MAT4&&(Se=4),X[ae]={type:pe.type,location:z.getAttribLocation(Z,ae),locationSize:Se}}return X})(r,_)}let G,F;r.attachShader(_,L),r.attachShader(_,I),t.index0AttributeName!==void 0?r.bindAttribLocation(_,0,t.index0AttributeName):t.morphTargets===!0&&r.bindAttribLocation(_,0,"position"),r.linkProgram(_),this.getUniforms=function(){return G===void 0&&B(this),G},this.getAttributes=function(){return F===void 0&&B(this),F};let j=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return j===!1&&(j=r.getProgramParameter(_,37297)),j},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(_),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Mg++,this.cacheKey=e,this.usedTimes=1,this.program=_,this.vertexShader=L,this.fragmentShader=I,this}var Pg=0,kh=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,r=this._getShaderStage(t),a=this._getShaderStage(n),s=this._getShaderCacheForMaterial(e);return s.has(r)===!1&&(s.add(r),r.usedTimes++),s.has(a)===!1&&(s.add(a),a.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Hh(e),t.set(e,n)),n}},Hh=class{constructor(e){this.id=Pg++,this.code=e,this.usedTimes=0}};function Dg(i,e,t,n,r,a,s){let o=new Yi,c=new kh,l=new Set,h=[],u=r.logarithmicDepthBuffer,d=r.vertexTextures,p=r.precision,f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(m){return l.add(m),m===0?"uv":`uv${m}`}return{getParameters:function(m,g,y,x,b){let L=x.fog,I=b.geometry,B=m.isMeshStandardMaterial?x.environment:null,G=(m.isMeshStandardMaterial?t:e).get(m.envMap||B),F=G&&G.mapping===_s?G.image.height:null,j=f[m.type];m.precision!==null&&(p=r.getMaxPrecision(m.precision),p!==m.precision&&console.warn("THREE.WebGLProgram.getParameters:",m.precision,"not supported, using",p,"instead."));let K=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,z=K!==void 0?K.length:0,Z,X,Q,ie,pe=0;if(I.morphAttributes.position!==void 0&&(pe=1),I.morphAttributes.normal!==void 0&&(pe=2),I.morphAttributes.color!==void 0&&(pe=3),j){let Tt=lr[j];Z=Tt.vertexShader,X=Tt.fragmentShader}else Z=m.vertexShader,X=m.fragmentShader,c.update(m),Q=c.getVertexShaderID(m),ie=c.getFragmentShaderID(m);let ae=i.getRenderTarget(),Se=i.state.buffers.depth.getReversed(),Pe=b.isInstancedMesh===!0,ve=b.isBatchedMesh===!0,Re=!!m.map,ue=!!m.matcap,ge=!!G,me=!!m.aoMap,De=!!m.lightMap,Ve=!!m.bumpMap,w=!!m.normalMap,T=!!m.displacementMap,H=!!m.emissiveMap,D=!!m.metalnessMap,E=!!m.roughnessMap,R=m.anisotropy>0,U=m.clearcoat>0,P=m.dispersion>0,te=m.iridescence>0,V=m.sheen>0,W=m.transmission>0,de=R&&!!m.anisotropyMap,fe=U&&!!m.clearcoatMap,he=U&&!!m.clearcoatNormalMap,be=U&&!!m.clearcoatRoughnessMap,Ae=te&&!!m.iridescenceMap,Ne=te&&!!m.iridescenceThicknessMap,$e=V&&!!m.sheenColorMap,it=V&&!!m.sheenRoughnessMap,nt=!!m.specularMap,xe=!!m.specularColorMap,Ie=!!m.specularIntensityMap,ze=W&&!!m.transmissionMap,Ct=W&&!!m.thicknessMap,we=!!m.gradientMap,rt=!!m.alphaMap,Xe=m.alphaTest>0,tn=!!m.alphaHash,ot=!!m.extensions,N=vr;m.toneMapped&&(ae!==null&&ae.isXRRenderTarget!==!0||(N=i.toneMapping));let Lt={shaderID:j,shaderType:m.type,shaderName:m.name,vertexShader:Z,fragmentShader:X,defines:m.defines,customVertexShaderID:Q,customFragmentShaderID:ie,isRawShaderMaterial:m.isRawShaderMaterial===!0,glslVersion:m.glslVersion,precision:p,batching:ve,batchingColor:ve&&b._colorsTexture!==null,instancing:Pe,instancingColor:Pe&&b.instanceColor!==null,instancingMorph:Pe&&b.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:ae===null?i.outputColorSpace:ae.isXRRenderTarget===!0?ae.texture.colorSpace:ti,alphaToCoverage:!!m.alphaToCoverage,map:Re,matcap:ue,envMap:ge,envMapMode:ge&&G.mapping,envMapCubeUVHeight:F,aoMap:me,lightMap:De,bumpMap:Ve,normalMap:w,displacementMap:d&&T,emissiveMap:H,normalMapObjectSpace:w&&m.normalMapType===Vd,normalMapTangentSpace:w&&m.normalMapType===Hd,metalnessMap:D,roughnessMap:E,anisotropy:R,anisotropyMap:de,clearcoat:U,clearcoatMap:fe,clearcoatNormalMap:he,clearcoatRoughnessMap:be,dispersion:P,iridescence:te,iridescenceMap:Ae,iridescenceThicknessMap:Ne,sheen:V,sheenColorMap:$e,sheenRoughnessMap:it,specularMap:nt,specularColorMap:xe,specularIntensityMap:Ie,transmission:W,transmissionMap:ze,thicknessMap:Ct,gradientMap:we,opaque:m.transparent===!1&&m.blending===ys&&m.alphaToCoverage===!1,alphaMap:rt,alphaTest:Xe,alphaHash:tn,combine:m.combine,mapUv:Re&&_(m.map.channel),aoMapUv:me&&_(m.aoMap.channel),lightMapUv:De&&_(m.lightMap.channel),bumpMapUv:Ve&&_(m.bumpMap.channel),normalMapUv:w&&_(m.normalMap.channel),displacementMapUv:T&&_(m.displacementMap.channel),emissiveMapUv:H&&_(m.emissiveMap.channel),metalnessMapUv:D&&_(m.metalnessMap.channel),roughnessMapUv:E&&_(m.roughnessMap.channel),anisotropyMapUv:de&&_(m.anisotropyMap.channel),clearcoatMapUv:fe&&_(m.clearcoatMap.channel),clearcoatNormalMapUv:he&&_(m.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:be&&_(m.clearcoatRoughnessMap.channel),iridescenceMapUv:Ae&&_(m.iridescenceMap.channel),iridescenceThicknessMapUv:Ne&&_(m.iridescenceThicknessMap.channel),sheenColorMapUv:$e&&_(m.sheenColorMap.channel),sheenRoughnessMapUv:it&&_(m.sheenRoughnessMap.channel),specularMapUv:nt&&_(m.specularMap.channel),specularColorMapUv:xe&&_(m.specularColorMap.channel),specularIntensityMapUv:Ie&&_(m.specularIntensityMap.channel),transmissionMapUv:ze&&_(m.transmissionMap.channel),thicknessMapUv:Ct&&_(m.thicknessMap.channel),alphaMapUv:rt&&_(m.alphaMap.channel),vertexTangents:!!I.attributes.tangent&&(w||R),vertexColors:m.vertexColors,vertexAlphas:m.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,pointsUvs:b.isPoints===!0&&!!I.attributes.uv&&(Re||rt),fog:!!L,useFog:m.fog===!0,fogExp2:!!L&&L.isFogExp2,flatShading:m.flatShading===!0&&m.wireframe===!1,sizeAttenuation:m.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:Se,skinning:b.isSkinnedMesh===!0,morphTargets:I.morphAttributes.position!==void 0,morphNormals:I.morphAttributes.normal!==void 0,morphColors:I.morphAttributes.color!==void 0,morphTargetsCount:z,morphTextureStride:pe,numDirLights:g.directional.length,numPointLights:g.point.length,numSpotLights:g.spot.length,numSpotLightMaps:g.spotLightMap.length,numRectAreaLights:g.rectArea.length,numHemiLights:g.hemi.length,numDirLightShadows:g.directionalShadowMap.length,numPointLightShadows:g.pointShadowMap.length,numSpotLightShadows:g.spotShadowMap.length,numSpotLightShadowsWithMaps:g.numSpotLightShadowsWithMaps,numLightProbes:g.numLightProbes,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:m.dithering,shadowMapEnabled:i.shadowMap.enabled&&y.length>0,shadowMapType:i.shadowMap.type,toneMapping:N,decodeVideoTexture:Re&&m.map.isVideoTexture===!0&&st.getTransfer(m.map.colorSpace)===vt,decodeVideoTextureEmissive:H&&m.emissiveMap.isVideoTexture===!0&&st.getTransfer(m.emissiveMap.colorSpace)===vt,premultipliedAlpha:m.premultipliedAlpha,doubleSided:m.side===Un,flipSided:m.side===bn,useDepthPacking:m.depthPacking>=0,depthPacking:m.depthPacking||0,index0AttributeName:m.index0AttributeName,extensionClipCullDistance:ot&&m.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ot&&m.extensions.multiDraw===!0||ve)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:m.customProgramCacheKey()};return Lt.vertexUv1s=l.has(1),Lt.vertexUv2s=l.has(2),Lt.vertexUv3s=l.has(3),l.clear(),Lt},getProgramCacheKey:function(m){let g=[];if(m.shaderID?g.push(m.shaderID):(g.push(m.customVertexShaderID),g.push(m.customFragmentShaderID)),m.defines!==void 0)for(let y in m.defines)g.push(y),g.push(m.defines[y]);return m.isRawShaderMaterial===!1&&((function(y,x){y.push(x.precision),y.push(x.outputColorSpace),y.push(x.envMapMode),y.push(x.envMapCubeUVHeight),y.push(x.mapUv),y.push(x.alphaMapUv),y.push(x.lightMapUv),y.push(x.aoMapUv),y.push(x.bumpMapUv),y.push(x.normalMapUv),y.push(x.displacementMapUv),y.push(x.emissiveMapUv),y.push(x.metalnessMapUv),y.push(x.roughnessMapUv),y.push(x.anisotropyMapUv),y.push(x.clearcoatMapUv),y.push(x.clearcoatNormalMapUv),y.push(x.clearcoatRoughnessMapUv),y.push(x.iridescenceMapUv),y.push(x.iridescenceThicknessMapUv),y.push(x.sheenColorMapUv),y.push(x.sheenRoughnessMapUv),y.push(x.specularMapUv),y.push(x.specularColorMapUv),y.push(x.specularIntensityMapUv),y.push(x.transmissionMapUv),y.push(x.thicknessMapUv),y.push(x.combine),y.push(x.fogExp2),y.push(x.sizeAttenuation),y.push(x.morphTargetsCount),y.push(x.morphAttributeCount),y.push(x.numDirLights),y.push(x.numPointLights),y.push(x.numSpotLights),y.push(x.numSpotLightMaps),y.push(x.numHemiLights),y.push(x.numRectAreaLights),y.push(x.numDirLightShadows),y.push(x.numPointLightShadows),y.push(x.numSpotLightShadows),y.push(x.numSpotLightShadowsWithMaps),y.push(x.numLightProbes),y.push(x.shadowMapType),y.push(x.toneMapping),y.push(x.numClippingPlanes),y.push(x.numClipIntersection),y.push(x.depthPacking)})(g,m),(function(y,x){o.disableAll(),x.supportsVertexTextures&&o.enable(0),x.instancing&&o.enable(1),x.instancingColor&&o.enable(2),x.instancingMorph&&o.enable(3),x.matcap&&o.enable(4),x.envMap&&o.enable(5),x.normalMapObjectSpace&&o.enable(6),x.normalMapTangentSpace&&o.enable(7),x.clearcoat&&o.enable(8),x.iridescence&&o.enable(9),x.alphaTest&&o.enable(10),x.vertexColors&&o.enable(11),x.vertexAlphas&&o.enable(12),x.vertexUv1s&&o.enable(13),x.vertexUv2s&&o.enable(14),x.vertexUv3s&&o.enable(15),x.vertexTangents&&o.enable(16),x.anisotropy&&o.enable(17),x.alphaHash&&o.enable(18),x.batching&&o.enable(19),x.dispersion&&o.enable(20),x.batchingColor&&o.enable(21),x.gradientMap&&o.enable(22),y.push(o.mask),o.disableAll(),x.fog&&o.enable(0),x.useFog&&o.enable(1),x.flatShading&&o.enable(2),x.logarithmicDepthBuffer&&o.enable(3),x.reversedDepthBuffer&&o.enable(4),x.skinning&&o.enable(5),x.morphTargets&&o.enable(6),x.morphNormals&&o.enable(7),x.morphColors&&o.enable(8),x.premultipliedAlpha&&o.enable(9),x.shadowMapEnabled&&o.enable(10),x.doubleSided&&o.enable(11),x.flipSided&&o.enable(12),x.useDepthPacking&&o.enable(13),x.dithering&&o.enable(14),x.transmission&&o.enable(15),x.sheen&&o.enable(16),x.opaque&&o.enable(17),x.pointsUvs&&o.enable(18),x.decodeVideoTexture&&o.enable(19),x.decodeVideoTextureEmissive&&o.enable(20),x.alphaToCoverage&&o.enable(21),y.push(o.mask)})(g,m),g.push(i.outputColorSpace)),g.push(m.customProgramCacheKey),g.join()},getUniforms:function(m){let g=f[m.type],y;if(g){let x=lr[g];y=$d.clone(x.uniforms)}else y=m.uniforms;return y},acquireProgram:function(m,g){let y;for(let x=0,b=h.length;x<b;x++){let L=h[x];if(L.cacheKey===g){y=L,++y.usedTimes;break}}return y===void 0&&(y=new Lg(i,g,m,a),h.push(y)),y},releaseProgram:function(m){if(--m.usedTimes===0){let g=h.indexOf(m);h[g]=h[h.length-1],h.pop(),m.destroy()}},releaseShaderCache:function(m){c.remove(m)},programs:h,dispose:function(){c.dispose()}}}function Ng(){let i=new WeakMap;return{has:function(e){return i.has(e)},get:function(e){let t=i.get(e);return t===void 0&&(t={},i.set(e,t)),t},remove:function(e){i.delete(e)},update:function(e,t,n){i.get(e)[t]=n},dispose:function(){i=new WeakMap}}}function Ug(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.z!==e.z?i.z-e.z:i.id-e.id}function bp(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Sp(){let i=[],e=0,t=[],n=[],r=[];function a(s,o,c,l,h,u){let d=i[e];return d===void 0?(d={id:s.id,object:s,geometry:o,material:c,groupOrder:l,renderOrder:s.renderOrder,z:h,group:u},i[e]=d):(d.id=s.id,d.object=s,d.geometry=o,d.material=c,d.groupOrder=l,d.renderOrder=s.renderOrder,d.z=h,d.group=u),e++,d}return{opaque:t,transmissive:n,transparent:r,init:function(){e=0,t.length=0,n.length=0,r.length=0},push:function(s,o,c,l,h,u){let d=a(s,o,c,l,h,u);c.transmission>0?n.push(d):c.transparent===!0?r.push(d):t.push(d)},unshift:function(s,o,c,l,h,u){let d=a(s,o,c,l,h,u);c.transmission>0?n.unshift(d):c.transparent===!0?r.unshift(d):t.unshift(d)},finish:function(){for(let s=e,o=i.length;s<o;s++){let c=i[s];if(c.id===null)break;c.id=null,c.object=null,c.geometry=null,c.material=null,c.group=null}},sort:function(s,o){t.length>1&&t.sort(s||Ug),n.length>1&&n.sort(o||bp),r.length>1&&r.sort(o||bp)}}}function Og(){let i=new WeakMap;return{get:function(e,t){let n=i.get(e),r;return n===void 0?(r=new Sp,i.set(e,[r])):t>=n.length?(r=new Sp,n.push(r)):r=n[t],r},dispose:function(){i=new WeakMap}}}function Bg(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new M,color:new ke};break;case"SpotLight":t={position:new M,direction:new M,color:new ke,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new M,color:new ke,distance:0,decay:0};break;case"HemisphereLight":t={direction:new M,skyColor:new ke,groundColor:new ke};break;case"RectAreaLight":t={color:new ke,position:new M,halfWidth:new M,halfHeight:new M}}return i[e.id]=t,t}}}var Fg=0;function kg(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Hg(i){let e=new Bg,t=(function(){let o={};return{get:function(c){if(o[c.id]!==void 0)return o[c.id];let l;switch(c.type){case"DirectionalLight":case"SpotLight":l={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new oe};break;case"PointLight":l={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new oe,shadowCameraNear:1,shadowCameraFar:1e3}}return o[c.id]=l,l}}})(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let o=0;o<9;o++)n.probe.push(new M);let r=new M,a=new Ke,s=new Ke;return{setup:function(o){let c=0,l=0,h=0;for(let B=0;B<9;B++)n.probe[B].set(0,0,0);let u=0,d=0,p=0,f=0,_=0,m=0,g=0,y=0,x=0,b=0,L=0;o.sort(kg);for(let B=0,G=o.length;B<G;B++){let F=o[B],j=F.color,K=F.intensity,z=F.distance,Z=F.shadow&&F.shadow.map?F.shadow.map.texture:null;if(F.isAmbientLight)c+=j.r*K,l+=j.g*K,h+=j.b*K;else if(F.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(F.sh.coefficients[X],K);L++}else if(F.isDirectionalLight){let X=e.get(F);if(X.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){let Q=F.shadow,ie=t.get(F);ie.shadowIntensity=Q.intensity,ie.shadowBias=Q.bias,ie.shadowNormalBias=Q.normalBias,ie.shadowRadius=Q.radius,ie.shadowMapSize=Q.mapSize,n.directionalShadow[u]=ie,n.directionalShadowMap[u]=Z,n.directionalShadowMatrix[u]=F.shadow.matrix,m++}n.directional[u]=X,u++}else if(F.isSpotLight){let X=e.get(F);X.position.setFromMatrixPosition(F.matrixWorld),X.color.copy(j).multiplyScalar(K),X.distance=z,X.coneCos=Math.cos(F.angle),X.penumbraCos=Math.cos(F.angle*(1-F.penumbra)),X.decay=F.decay,n.spot[p]=X;let Q=F.shadow;if(F.map&&(n.spotLightMap[x]=F.map,x++,Q.updateMatrices(F),F.castShadow&&b++),n.spotLightMatrix[p]=Q.matrix,F.castShadow){let ie=t.get(F);ie.shadowIntensity=Q.intensity,ie.shadowBias=Q.bias,ie.shadowNormalBias=Q.normalBias,ie.shadowRadius=Q.radius,ie.shadowMapSize=Q.mapSize,n.spotShadow[p]=ie,n.spotShadowMap[p]=Z,y++}p++}else if(F.isRectAreaLight){let X=e.get(F);X.color.copy(j).multiplyScalar(K),X.halfWidth.set(.5*F.width,0,0),X.halfHeight.set(0,.5*F.height,0),n.rectArea[f]=X,f++}else if(F.isPointLight){let X=e.get(F);if(X.color.copy(F.color).multiplyScalar(F.intensity),X.distance=F.distance,X.decay=F.decay,F.castShadow){let Q=F.shadow,ie=t.get(F);ie.shadowIntensity=Q.intensity,ie.shadowBias=Q.bias,ie.shadowNormalBias=Q.normalBias,ie.shadowRadius=Q.radius,ie.shadowMapSize=Q.mapSize,ie.shadowCameraNear=Q.camera.near,ie.shadowCameraFar=Q.camera.far,n.pointShadow[d]=ie,n.pointShadowMap[d]=Z,n.pointShadowMatrix[d]=F.shadow.matrix,g++}n.point[d]=X,d++}else if(F.isHemisphereLight){let X=e.get(F);X.skyColor.copy(F.color).multiplyScalar(K),X.groundColor.copy(F.groundColor).multiplyScalar(K),n.hemi[_]=X,_++}}f>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=_e.LTC_FLOAT_1,n.rectAreaLTC2=_e.LTC_FLOAT_2):(n.rectAreaLTC1=_e.LTC_HALF_1,n.rectAreaLTC2=_e.LTC_HALF_2)),n.ambient[0]=c,n.ambient[1]=l,n.ambient[2]=h;let I=n.hash;I.directionalLength===u&&I.pointLength===d&&I.spotLength===p&&I.rectAreaLength===f&&I.hemiLength===_&&I.numDirectionalShadows===m&&I.numPointShadows===g&&I.numSpotShadows===y&&I.numSpotMaps===x&&I.numLightProbes===L||(n.directional.length=u,n.spot.length=p,n.rectArea.length=f,n.point.length=d,n.hemi.length=_,n.directionalShadow.length=m,n.directionalShadowMap.length=m,n.pointShadow.length=g,n.pointShadowMap.length=g,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=m,n.pointShadowMatrix.length=g,n.spotLightMatrix.length=y+x-b,n.spotLightMap.length=x,n.numSpotLightShadowsWithMaps=b,n.numLightProbes=L,I.directionalLength=u,I.pointLength=d,I.spotLength=p,I.rectAreaLength=f,I.hemiLength=_,I.numDirectionalShadows=m,I.numPointShadows=g,I.numSpotShadows=y,I.numSpotMaps=x,I.numLightProbes=L,n.version=Fg++)},setupView:function(o,c){let l=0,h=0,u=0,d=0,p=0,f=c.matrixWorldInverse;for(let _=0,m=o.length;_<m;_++){let g=o[_];if(g.isDirectionalLight){let y=n.directional[l];y.direction.setFromMatrixPosition(g.matrixWorld),r.setFromMatrixPosition(g.target.matrixWorld),y.direction.sub(r),y.direction.transformDirection(f),l++}else if(g.isSpotLight){let y=n.spot[u];y.position.setFromMatrixPosition(g.matrixWorld),y.position.applyMatrix4(f),y.direction.setFromMatrixPosition(g.matrixWorld),r.setFromMatrixPosition(g.target.matrixWorld),y.direction.sub(r),y.direction.transformDirection(f),u++}else if(g.isRectAreaLight){let y=n.rectArea[d];y.position.setFromMatrixPosition(g.matrixWorld),y.position.applyMatrix4(f),s.identity(),a.copy(g.matrixWorld),a.premultiply(f),s.extractRotation(a),y.halfWidth.set(.5*g.width,0,0),y.halfHeight.set(0,.5*g.height,0),y.halfWidth.applyMatrix4(s),y.halfHeight.applyMatrix4(s),d++}else if(g.isPointLight){let y=n.point[h];y.position.setFromMatrixPosition(g.matrixWorld),y.position.applyMatrix4(f),h++}else if(g.isHemisphereLight){let y=n.hemi[p];y.direction.setFromMatrixPosition(g.matrixWorld),y.direction.transformDirection(f),p++}}},state:n}}function Tp(i){let e=new Hg(i),t=[],n=[],r={lightsArray:t,shadowsArray:n,camera:null,lights:e,transmissionRenderTarget:{}};return{init:function(a){r.camera=a,t.length=0,n.length=0},state:r,setupLights:function(){e.setup(t)},setupLightsView:function(a){e.setupView(t,a)},pushLight:function(a){t.push(a)},pushShadow:function(a){n.push(a)}}}function Vg(i){let e=new WeakMap;return{get:function(t,n=0){let r=e.get(t),a;return r===void 0?(a=new Tp(i),e.set(t,[a])):n>=r.length?(a=new Tp(i),r.push(a)):a=r[n],a},dispose:function(){e=new WeakMap}}}function zg(i,e,t){let n=new Pr,r=new oe,a=new oe,s=new Rt,o=new Ho({depthPacking:kd}),c=new Vo,l={},h=t.maxTextureSize,u={[ia]:bn,[bn]:ia,[Un]:Un},d=new Wn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new oe},radius:{value:4}},vertexShader:`void main() {
	gl_Position = vec4( position, 1.0 );
}`,fragmentShader:`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`}),p=d.clone();p.defines.HORIZONTAL_PASS=1;let f=new tt;f.setAttribute("position",new Nt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new Bt(f,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Bc;let g=this.type;function y(I,B){let G=e.update(_);d.defines.VSM_SAMPLES!==I.blurSamples&&(d.defines.VSM_SAMPLES=I.blurSamples,p.defines.VSM_SAMPLES=I.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),I.mapPass===null&&(I.mapPass=new nr(r.x,r.y)),d.uniforms.shadow_pass.value=I.map.texture,d.uniforms.resolution.value=I.mapSize,d.uniforms.radius.value=I.radius,i.setRenderTarget(I.mapPass),i.clear(),i.renderBufferDirect(B,null,G,d,_,null),p.uniforms.shadow_pass.value=I.mapPass.texture,p.uniforms.resolution.value=I.mapSize,p.uniforms.radius.value=I.radius,i.setRenderTarget(I.map),i.clear(),i.renderBufferDirect(B,null,G,p,_,null)}function x(I,B,G,F){let j=null,K=G.isPointLight===!0?I.customDistanceMaterial:I.customDepthMaterial;if(K!==void 0)j=K;else if(j=G.isPointLight===!0?c:o,i.localClippingEnabled&&B.clipShadows===!0&&Array.isArray(B.clippingPlanes)&&B.clippingPlanes.length!==0||B.displacementMap&&B.displacementScale!==0||B.alphaMap&&B.alphaTest>0||B.map&&B.alphaTest>0||B.alphaToCoverage===!0){let z=j.uuid,Z=B.uuid,X=l[z];X===void 0&&(X={},l[z]=X);let Q=X[Z];Q===void 0&&(Q=j.clone(),X[Z]=Q,B.addEventListener("dispose",L)),j=Q}return j.visible=B.visible,j.wireframe=B.wireframe,j.side=F===sr?B.shadowSide!==null?B.shadowSide:B.side:B.shadowSide!==null?B.shadowSide:u[B.side],j.alphaMap=B.alphaMap,j.alphaTest=B.alphaToCoverage===!0?.5:B.alphaTest,j.map=B.map,j.clipShadows=B.clipShadows,j.clippingPlanes=B.clippingPlanes,j.clipIntersection=B.clipIntersection,j.displacementMap=B.displacementMap,j.displacementScale=B.displacementScale,j.displacementBias=B.displacementBias,j.wireframeLinewidth=B.wireframeLinewidth,j.linewidth=B.linewidth,G.isPointLight===!0&&j.isMeshDistanceMaterial===!0&&(i.properties.get(j).light=G),j}function b(I,B,G,F,j){if(I.visible===!1)return;if(I.layers.test(B.layers)&&(I.isMesh||I.isLine||I.isPoints)&&(I.castShadow||I.receiveShadow&&j===sr)&&(!I.frustumCulled||n.intersectsObject(I))){I.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,I.matrixWorld);let z=e.update(I),Z=I.material;if(Array.isArray(Z)){let X=z.groups;for(let Q=0,ie=X.length;Q<ie;Q++){let pe=X[Q],ae=Z[pe.materialIndex];if(ae&&ae.visible){let Se=x(I,ae,F,j);I.onBeforeShadow(i,I,B,G,z,Se,pe),i.renderBufferDirect(G,null,z,Se,I,pe),I.onAfterShadow(i,I,B,G,z,Se,pe)}}}else if(Z.visible){let X=x(I,Z,F,j);I.onBeforeShadow(i,I,B,G,z,X,null),i.renderBufferDirect(G,null,z,X,I,null),I.onAfterShadow(i,I,B,G,z,X,null)}}let K=I.children;for(let z=0,Z=K.length;z<Z;z++)b(K[z],B,G,F,j)}function L(I){I.target.removeEventListener("dispose",L);for(let B in l){let G=l[B],F=I.target.uuid;F in G&&(G[F].dispose(),delete G[F])}}this.render=function(I,B,G){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||I.length===0)return;let F=i.getRenderTarget(),j=i.getActiveCubeFace(),K=i.getActiveMipmapLevel(),z=i.state;z.setBlending(Fr),z.buffers.depth.getReversed()===!0?z.buffers.color.setClear(0,0,0,0):z.buffers.color.setClear(1,1,1,1),z.buffers.depth.setTest(!0),z.setScissorTest(!1);let Z=g!==sr&&this.type===sr,X=g===sr&&this.type!==sr;for(let Q=0,ie=I.length;Q<ie;Q++){let pe=I[Q],ae=pe.shadow;if(ae===void 0){console.warn("THREE.WebGLShadowMap:",pe,"has no shadow.");continue}if(ae.autoUpdate===!1&&ae.needsUpdate===!1)continue;r.copy(ae.mapSize);let Se=ae.getFrameExtents();if(r.multiply(Se),a.copy(ae.mapSize),(r.x>h||r.y>h)&&(r.x>h&&(a.x=Math.floor(h/Se.x),r.x=a.x*Se.x,ae.mapSize.x=a.x),r.y>h&&(a.y=Math.floor(h/Se.y),r.y=a.y*Se.y,ae.mapSize.y=a.y)),ae.map===null||Z===!0||X===!0){let ve=this.type!==sr?{minFilter:Qn,magFilter:Qn}:{};ae.map!==null&&ae.map.dispose(),ae.map=new nr(r.x,r.y,ve),ae.map.texture.name=pe.name+".shadowMap",ae.camera.updateProjectionMatrix()}i.setRenderTarget(ae.map),i.clear();let Pe=ae.getViewportCount();for(let ve=0;ve<Pe;ve++){let Re=ae.getViewport(ve);s.set(a.x*Re.x,a.y*Re.y,a.x*Re.z,a.y*Re.w),z.viewport(s),ae.updateMatrices(pe,ve),n=ae.getFrustum(),b(B,G,ae.camera,pe,this.type)}ae.isPointLightShadow!==!0&&this.type===sr&&y(ae,G),ae.needsUpdate=!1}g=this.type,m.needsUpdate=!1,i.setRenderTarget(F,j,K)}}var Gg={[$o]:Qo,[el]:rl,[tl]:il,[vs]:nl,[Qo]:$o,[rl]:el,[il]:tl,[nl]:vs};function Wg(i,e){let t=new function(){let E=!1,R=new Rt,U=null,P=new Rt(0,0,0,0);return{setMask:function(te){U===te||E||(i.colorMask(te,te,te,te),U=te)},setLocked:function(te){E=te},setClear:function(te,V,W,de,fe){fe===!0&&(te*=de,V*=de,W*=de),R.set(te,V,W,de),P.equals(R)===!1&&(i.clearColor(te,V,W,de),P.copy(R))},reset:function(){E=!1,U=null,P.set(-1,0,0,0)}}},n=new function(){let E=!1,R=!1,U=null,P=null,te=null;return{setReversed:function(V){if(R!==V){let W=e.get("EXT_clip_control");V?W.clipControlEXT(W.LOWER_LEFT_EXT,W.ZERO_TO_ONE_EXT):W.clipControlEXT(W.LOWER_LEFT_EXT,W.NEGATIVE_ONE_TO_ONE_EXT),R=V;let de=te;te=null,this.setClear(de)}},getReversed:function(){return R},setTest:function(V){V?ge(i.DEPTH_TEST):me(i.DEPTH_TEST)},setMask:function(V){U===V||E||(i.depthMask(V),U=V)},setFunc:function(V){if(R&&(V=Gg[V]),P!==V){switch(V){case $o:i.depthFunc(i.NEVER);break;case Qo:i.depthFunc(i.ALWAYS);break;case el:i.depthFunc(i.LESS);break;case vs:i.depthFunc(i.LEQUAL);break;case tl:i.depthFunc(i.EQUAL);break;case nl:i.depthFunc(i.GEQUAL);break;case rl:i.depthFunc(i.GREATER);break;case il:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}P=V}},setLocked:function(V){E=V},setClear:function(V){te!==V&&(R&&(V=1-V),i.clearDepth(V),te=V)},reset:function(){E=!1,U=null,P=null,te=null,R=!1}}},r=new function(){let E=!1,R=null,U=null,P=null,te=null,V=null,W=null,de=null,fe=null;return{setTest:function(he){E||(he?ge(i.STENCIL_TEST):me(i.STENCIL_TEST))},setMask:function(he){R===he||E||(i.stencilMask(he),R=he)},setFunc:function(he,be,Ae){U===he&&P===be&&te===Ae||(i.stencilFunc(he,be,Ae),U=he,P=be,te=Ae)},setOp:function(he,be,Ae){V===he&&W===be&&de===Ae||(i.stencilOp(he,be,Ae),V=he,W=be,de=Ae)},setLocked:function(he){E=he},setClear:function(he){fe!==he&&(i.clearStencil(he),fe=he)},reset:function(){E=!1,R=null,U=null,P=null,te=null,V=null,W=null,de=null,fe=null}}},a=new WeakMap,s=new WeakMap,o={},c={},l=new WeakMap,h=[],u=null,d=!1,p=null,f=null,_=null,m=null,g=null,y=null,x=null,b=new ke(0,0,0),L=0,I=!1,B=null,G=null,F=null,j=null,K=null,z=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Z=!1,X=0,Q=i.getParameter(i.VERSION);Q.indexOf("WebGL")!==-1?(X=parseFloat(/^WebGL (\d)/.exec(Q)[1]),Z=X>=1):Q.indexOf("OpenGL ES")!==-1&&(X=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),Z=X>=2);let ie=null,pe={},ae=i.getParameter(i.SCISSOR_BOX),Se=i.getParameter(i.VIEWPORT),Pe=new Rt().fromArray(ae),ve=new Rt().fromArray(Se);function Re(E,R,U,P){let te=new Uint8Array(4),V=i.createTexture();i.bindTexture(E,V),i.texParameteri(E,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(E,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let W=0;W<U;W++)E===i.TEXTURE_3D||E===i.TEXTURE_2D_ARRAY?i.texImage3D(R,0,i.RGBA,1,1,P,0,i.RGBA,i.UNSIGNED_BYTE,te):i.texImage2D(R+W,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,te);return V}let ue={};function ge(E){o[E]!==!0&&(i.enable(E),o[E]=!0)}function me(E){o[E]!==!1&&(i.disable(E),o[E]=!1)}ue[i.TEXTURE_2D]=Re(i.TEXTURE_2D,i.TEXTURE_2D,1),ue[i.TEXTURE_CUBE_MAP]=Re(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),ue[i.TEXTURE_2D_ARRAY]=Re(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),ue[i.TEXTURE_3D]=Re(i.TEXTURE_3D,i.TEXTURE_3D,1,1),t.setClear(0,0,0,1),n.setClear(1),r.setClear(0),ge(i.DEPTH_TEST),n.setFunc(vs),T(!1),H(Oc),ge(i.CULL_FACE),w(Fr);let De={[aa]:i.FUNC_ADD,[sd]:i.FUNC_SUBTRACT,[od]:i.FUNC_REVERSE_SUBTRACT};De[ld]=i.MIN,De[cd]=i.MAX;let Ve={[hd]:i.ZERO,[ud]:i.ONE,[dd]:i.SRC_COLOR,[md]:i.SRC_ALPHA,[xd]:i.SRC_ALPHA_SATURATE,[vd]:i.DST_COLOR,[gd]:i.DST_ALPHA,[pd]:i.ONE_MINUS_SRC_COLOR,[fd]:i.ONE_MINUS_SRC_ALPHA,[_d]:i.ONE_MINUS_DST_COLOR,[yd]:i.ONE_MINUS_DST_ALPHA,[Ed]:i.CONSTANT_COLOR,[Md]:i.ONE_MINUS_CONSTANT_COLOR,[bd]:i.CONSTANT_ALPHA,[Sd]:i.ONE_MINUS_CONSTANT_ALPHA};function w(E,R,U,P,te,V,W,de,fe,he){if(E!==Fr){if(d===!1&&(ge(i.BLEND),d=!0),E===ad)te=te||R,V=V||U,W=W||P,R===f&&te===g||(i.blendEquationSeparate(De[R],De[te]),f=R,g=te),U===_&&P===m&&V===y&&W===x||(i.blendFuncSeparate(Ve[U],Ve[P],Ve[V],Ve[W]),_=U,m=P,y=V,x=W),de.equals(b)!==!1&&fe===L||(i.blendColor(de.r,de.g,de.b,fe),b.copy(de),L=fe),p=E,I=!1;else if(E!==p||he!==I){if(f===aa&&g===aa||(i.blendEquation(i.FUNC_ADD),f=aa,g=aa),he)switch(E){case ys:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Fc:i.blendFunc(i.ONE,i.ONE);break;case kc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Hc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",E)}else switch(E){case ys:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Fc:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case kc:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Hc:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",E)}_=null,m=null,y=null,x=null,b.set(0,0,0),L=0,p=E,I=he}}else d===!0&&(me(i.BLEND),d=!1)}function T(E){B!==E&&(E?i.frontFace(i.CW):i.frontFace(i.CCW),B=E)}function H(E){E!==nd?(ge(i.CULL_FACE),E!==G&&(E===Oc?i.cullFace(i.BACK):E===rd?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):me(i.CULL_FACE),G=E}function D(E,R,U){E?(ge(i.POLYGON_OFFSET_FILL),j===R&&K===U||(i.polygonOffset(R,U),j=R,K=U)):me(i.POLYGON_OFFSET_FILL)}return{buffers:{color:t,depth:n,stencil:r},enable:ge,disable:me,bindFramebuffer:function(E,R){return c[E]!==R&&(i.bindFramebuffer(E,R),c[E]=R,E===i.DRAW_FRAMEBUFFER&&(c[i.FRAMEBUFFER]=R),E===i.FRAMEBUFFER&&(c[i.DRAW_FRAMEBUFFER]=R),!0)},drawBuffers:function(E,R){let U=h,P=!1;if(E){U=l.get(R),U===void 0&&(U=[],l.set(R,U));let te=E.textures;if(U.length!==te.length||U[0]!==i.COLOR_ATTACHMENT0){for(let V=0,W=te.length;V<W;V++)U[V]=i.COLOR_ATTACHMENT0+V;U.length=te.length,P=!0}}else U[0]!==i.BACK&&(U[0]=i.BACK,P=!0);P&&i.drawBuffers(U)},useProgram:function(E){return u!==E&&(i.useProgram(E),u=E,!0)},setBlending:w,setMaterial:function(E,R){E.side===Un?me(i.CULL_FACE):ge(i.CULL_FACE);let U=E.side===bn;R&&(U=!U),T(U),E.blending===ys&&E.transparent===!1?w(Fr):w(E.blending,E.blendEquation,E.blendSrc,E.blendDst,E.blendEquationAlpha,E.blendSrcAlpha,E.blendDstAlpha,E.blendColor,E.blendAlpha,E.premultipliedAlpha),n.setFunc(E.depthFunc),n.setTest(E.depthTest),n.setMask(E.depthWrite),t.setMask(E.colorWrite);let P=E.stencilWrite;r.setTest(P),P&&(r.setMask(E.stencilWriteMask),r.setFunc(E.stencilFunc,E.stencilRef,E.stencilFuncMask),r.setOp(E.stencilFail,E.stencilZFail,E.stencilZPass)),D(E.polygonOffset,E.polygonOffsetFactor,E.polygonOffsetUnits),E.alphaToCoverage===!0?ge(i.SAMPLE_ALPHA_TO_COVERAGE):me(i.SAMPLE_ALPHA_TO_COVERAGE)},setFlipSided:T,setCullFace:H,setLineWidth:function(E){E!==F&&(Z&&i.lineWidth(E),F=E)},setPolygonOffset:D,setScissorTest:function(E){E?ge(i.SCISSOR_TEST):me(i.SCISSOR_TEST)},activeTexture:function(E){E===void 0&&(E=i.TEXTURE0+z-1),ie!==E&&(i.activeTexture(E),ie=E)},bindTexture:function(E,R,U){U===void 0&&(U=ie===null?i.TEXTURE0+z-1:ie);let P=pe[U];P===void 0&&(P={type:void 0,texture:void 0},pe[U]=P),P.type===E&&P.texture===R||(ie!==U&&(i.activeTexture(U),ie=U),i.bindTexture(E,R||ue[E]),P.type=E,P.texture=R)},unbindTexture:function(){let E=pe[ie];E!==void 0&&E.type!==void 0&&(i.bindTexture(E.type,null),E.type=void 0,E.texture=void 0)},compressedTexImage2D:function(){try{i.compressedTexImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},compressedTexImage3D:function(){try{i.compressedTexImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},texImage2D:function(){try{i.texImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},texImage3D:function(){try{i.texImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},updateUBOMapping:function(E,R){let U=s.get(R);U===void 0&&(U=new WeakMap,s.set(R,U));let P=U.get(E);P===void 0&&(P=i.getUniformBlockIndex(R,E.name),U.set(E,P))},uniformBlockBinding:function(E,R){let U=s.get(R).get(E);a.get(R)!==U&&(i.uniformBlockBinding(R,U,E.__bindingPointIndex),a.set(R,U))},texStorage2D:function(){try{i.texStorage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},texStorage3D:function(){try{i.texStorage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},texSubImage2D:function(){try{i.texSubImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},texSubImage3D:function(){try{i.texSubImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},compressedTexSubImage2D:function(){try{i.compressedTexSubImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},compressedTexSubImage3D:function(){try{i.compressedTexSubImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}},scissor:function(E){Pe.equals(E)===!1&&(i.scissor(E.x,E.y,E.z,E.w),Pe.copy(E))},viewport:function(E){ve.equals(E)===!1&&(i.viewport(E.x,E.y,E.z,E.w),ve.copy(E))},reset:function(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),n.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),o={},ie=null,pe={},c={},l=new WeakMap,h=[],u=null,d=!1,p=null,f=null,_=null,m=null,g=null,y=null,x=null,b=new ke(0,0,0),L=0,I=!1,B=null,G=null,F=null,j=null,K=null,Pe.set(0,0,i.canvas.width,i.canvas.height),ve.set(0,0,i.canvas.width,i.canvas.height),t.reset(),n.reset(),r.reset()}}}function Xg(i,e,t,n,r,a,s){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator<"u"&&/OculusBrowser/g.test(navigator.userAgent),l=new oe,h=new WeakMap,u,d=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function f(w,T){return p?new OffscreenCanvas(w,T):za("canvas")}function _(w,T,H){let D=1,E=Ve(w);if((E.width>H||E.height>H)&&(D=H/Math.max(E.width,E.height)),D<1){if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){let R=Math.floor(D*E.width),U=Math.floor(D*E.height);u===void 0&&(u=f(R,U));let P=T?f(R,U):u;return P.width=R,P.height=U,P.getContext("2d").drawImage(w,0,0,R,U),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+E.width+"x"+E.height+") to ("+R+"x"+U+")."),P}return"data"in w&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+E.width+"x"+E.height+")."),w}return w}function m(w){return w.generateMipmaps}function g(w){i.generateMipmap(w)}function y(w){return w.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:w.isWebGL3DRenderTarget?i.TEXTURE_3D:w.isWebGLArrayRenderTarget||w.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function x(w,T,H,D,E=!1){if(w!==null){if(i[w]!==void 0)return i[w];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let R=T;if(T===i.RED&&(H===i.FLOAT&&(R=i.R32F),H===i.HALF_FLOAT&&(R=i.R16F),H===i.UNSIGNED_BYTE&&(R=i.R8)),T===i.RED_INTEGER&&(H===i.UNSIGNED_BYTE&&(R=i.R8UI),H===i.UNSIGNED_SHORT&&(R=i.R16UI),H===i.UNSIGNED_INT&&(R=i.R32UI),H===i.BYTE&&(R=i.R8I),H===i.SHORT&&(R=i.R16I),H===i.INT&&(R=i.R32I)),T===i.RG&&(H===i.FLOAT&&(R=i.RG32F),H===i.HALF_FLOAT&&(R=i.RG16F),H===i.UNSIGNED_BYTE&&(R=i.RG8)),T===i.RG_INTEGER&&(H===i.UNSIGNED_BYTE&&(R=i.RG8UI),H===i.UNSIGNED_SHORT&&(R=i.RG16UI),H===i.UNSIGNED_INT&&(R=i.RG32UI),H===i.BYTE&&(R=i.RG8I),H===i.SHORT&&(R=i.RG16I),H===i.INT&&(R=i.RG32I)),T===i.RGB_INTEGER&&(H===i.UNSIGNED_BYTE&&(R=i.RGB8UI),H===i.UNSIGNED_SHORT&&(R=i.RGB16UI),H===i.UNSIGNED_INT&&(R=i.RGB32UI),H===i.BYTE&&(R=i.RGB8I),H===i.SHORT&&(R=i.RGB16I),H===i.INT&&(R=i.RGB32I)),T===i.RGBA_INTEGER&&(H===i.UNSIGNED_BYTE&&(R=i.RGBA8UI),H===i.UNSIGNED_SHORT&&(R=i.RGBA16UI),H===i.UNSIGNED_INT&&(R=i.RGBA32UI),H===i.BYTE&&(R=i.RGBA8I),H===i.SHORT&&(R=i.RGBA16I),H===i.INT&&(R=i.RGBA32I)),T===i.RGB&&(H===i.UNSIGNED_INT_5_9_9_9_REV&&(R=i.RGB9_E5),H===i.UNSIGNED_INT_10F_11F_11F_REV&&(R=i.R11F_G11F_B10F)),T===i.RGBA){let U=E?Ha:st.getTransfer(D);H===i.FLOAT&&(R=i.RGBA32F),H===i.HALF_FLOAT&&(R=i.RGBA16F),H===i.UNSIGNED_BYTE&&(R=U===vt?i.SRGB8_ALPHA8:i.RGBA8),H===i.UNSIGNED_SHORT_4_4_4_4&&(R=i.RGBA4),H===i.UNSIGNED_SHORT_5_5_5_1&&(R=i.RGB5_A1)}return R!==i.R16F&&R!==i.R32F&&R!==i.RG16F&&R!==i.RG32F&&R!==i.RGBA16F&&R!==i.RGBA32F||e.get("EXT_color_buffer_float"),R}function b(w,T){let H;return w?T===null||T===ui||T===ca?H=i.DEPTH24_STENCIL8:T===Xn?H=i.DEPTH32F_STENCIL8:T===oa&&(H=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):T===null||T===ui||T===ca?H=i.DEPTH_COMPONENT24:T===Xn?H=i.DEPTH_COMPONENT32F:T===oa&&(H=i.DEPTH_COMPONENT16),H}function L(w,T){return m(w)===!0||w.isFramebufferTexture&&w.minFilter!==Qn&&w.minFilter!==er?Math.log2(Math.max(T.width,T.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?T.mipmaps.length:1}function I(w){let T=w.target;T.removeEventListener("dispose",I),(function(H){let D=n.get(H);if(D.__webglInit===void 0)return;let E=H.source,R=d.get(E);if(R){let U=R[D.__cacheKey];U.usedTimes--,U.usedTimes===0&&G(H),Object.keys(R).length===0&&d.delete(E)}n.remove(H)})(T),T.isVideoTexture&&h.delete(T)}function B(w){let T=w.target;T.removeEventListener("dispose",B),(function(H){let D=n.get(H);if(H.depthTexture&&(H.depthTexture.dispose(),n.remove(H.depthTexture)),H.isWebGLCubeRenderTarget)for(let R=0;R<6;R++){if(Array.isArray(D.__webglFramebuffer[R]))for(let U=0;U<D.__webglFramebuffer[R].length;U++)i.deleteFramebuffer(D.__webglFramebuffer[R][U]);else i.deleteFramebuffer(D.__webglFramebuffer[R]);D.__webglDepthbuffer&&i.deleteRenderbuffer(D.__webglDepthbuffer[R])}else{if(Array.isArray(D.__webglFramebuffer))for(let R=0;R<D.__webglFramebuffer.length;R++)i.deleteFramebuffer(D.__webglFramebuffer[R]);else i.deleteFramebuffer(D.__webglFramebuffer);if(D.__webglDepthbuffer&&i.deleteRenderbuffer(D.__webglDepthbuffer),D.__webglMultisampledFramebuffer&&i.deleteFramebuffer(D.__webglMultisampledFramebuffer),D.__webglColorRenderbuffer)for(let R=0;R<D.__webglColorRenderbuffer.length;R++)D.__webglColorRenderbuffer[R]&&i.deleteRenderbuffer(D.__webglColorRenderbuffer[R]);D.__webglDepthRenderbuffer&&i.deleteRenderbuffer(D.__webglDepthRenderbuffer)}let E=H.textures;for(let R=0,U=E.length;R<U;R++){let P=n.get(E[R]);P.__webglTexture&&(i.deleteTexture(P.__webglTexture),s.memory.textures--),n.remove(E[R])}n.remove(H)})(T)}function G(w){let T=n.get(w);i.deleteTexture(T.__webglTexture);let H=w.source;delete d.get(H)[T.__cacheKey],s.memory.textures--}let F=0;function j(w,T){let H=n.get(w);if(w.isVideoTexture&&(function(D){let E=s.render.frame;h.get(D)!==E&&(h.set(D,E),D.update())})(w),w.isRenderTargetTexture===!1&&w.isExternalTexture!==!0&&w.version>0&&H.__version!==w.version){let D=w.image;if(D===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else{if(D.complete!==!1)return void pe(H,w,T);console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete")}}else w.isExternalTexture&&(H.__webglTexture=w.sourceTexture?w.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,H.__webglTexture,i.TEXTURE0+T)}let K={[ho]:i.REPEAT,[Wi]:i.CLAMP_TO_EDGE,[uo]:i.MIRRORED_REPEAT},z={[Qn]:i.NEAREST,[Ud]:i.NEAREST_MIPMAP_NEAREST,[xs]:i.NEAREST_MIPMAP_LINEAR,[er]:i.LINEAR,[ol]:i.LINEAR_MIPMAP_NEAREST,[hi]:i.LINEAR_MIPMAP_LINEAR},Z={[zd]:i.NEVER,[Yd]:i.ALWAYS,[Gd]:i.LESS,[Mh]:i.LEQUAL,[Wd]:i.EQUAL,[qd]:i.GEQUAL,[Xd]:i.GREATER,[jd]:i.NOTEQUAL};function X(w,T){if(T.type!==Xn||e.has("OES_texture_float_linear")!==!1||T.magFilter!==er&&T.magFilter!==ol&&T.magFilter!==xs&&T.magFilter!==hi&&T.minFilter!==er&&T.minFilter!==ol&&T.minFilter!==xs&&T.minFilter!==hi||console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(w,i.TEXTURE_WRAP_S,K[T.wrapS]),i.texParameteri(w,i.TEXTURE_WRAP_T,K[T.wrapT]),w!==i.TEXTURE_3D&&w!==i.TEXTURE_2D_ARRAY||i.texParameteri(w,i.TEXTURE_WRAP_R,K[T.wrapR]),i.texParameteri(w,i.TEXTURE_MAG_FILTER,z[T.magFilter]),i.texParameteri(w,i.TEXTURE_MIN_FILTER,z[T.minFilter]),T.compareFunction&&(i.texParameteri(w,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(w,i.TEXTURE_COMPARE_FUNC,Z[T.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(T.magFilter===Qn||T.minFilter!==xs&&T.minFilter!==hi||T.type===Xn&&e.has("OES_texture_float_linear")===!1)return;if(T.anisotropy>1||n.get(T).__currentAnisotropy){let H=e.get("EXT_texture_filter_anisotropic");i.texParameterf(w,H.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(T.anisotropy,r.getMaxAnisotropy())),n.get(T).__currentAnisotropy=T.anisotropy}}}function Q(w,T){let H=!1;w.__webglInit===void 0&&(w.__webglInit=!0,T.addEventListener("dispose",I));let D=T.source,E=d.get(D);E===void 0&&(E={},d.set(D,E));let R=(function(U){let P=[];return P.push(U.wrapS),P.push(U.wrapT),P.push(U.wrapR||0),P.push(U.magFilter),P.push(U.minFilter),P.push(U.anisotropy),P.push(U.internalFormat),P.push(U.format),P.push(U.type),P.push(U.generateMipmaps),P.push(U.premultiplyAlpha),P.push(U.flipY),P.push(U.unpackAlignment),P.push(U.colorSpace),P.join()})(T);if(R!==w.__cacheKey){E[R]===void 0&&(E[R]={texture:i.createTexture(),usedTimes:0},s.memory.textures++,H=!0),E[R].usedTimes++;let U=E[w.__cacheKey];U!==void 0&&(E[w.__cacheKey].usedTimes--,U.usedTimes===0&&G(T)),w.__cacheKey=R,w.__webglTexture=E[R].texture}return H}function ie(w,T,H){return Math.floor(Math.floor(w/H)/T)}function pe(w,T,H){let D=i.TEXTURE_2D;(T.isDataArrayTexture||T.isCompressedArrayTexture)&&(D=i.TEXTURE_2D_ARRAY),T.isData3DTexture&&(D=i.TEXTURE_3D);let E=Q(w,T),R=T.source;t.bindTexture(D,w.__webglTexture,i.TEXTURE0+H);let U=n.get(R);if(R.version!==U.__version||E===!0){t.activeTexture(i.TEXTURE0+H);let P=st.getPrimaries(st.workingColorSpace),te=T.colorSpace===di?null:st.getPrimaries(T.colorSpace),V=T.colorSpace===di||P===te?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,T.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,T.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,T.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,V);let W=_(T.image,!1,r.maxTextureSize);W=De(T,W);let de=a.convert(T.format,T.colorSpace),fe=a.convert(T.type),he,be=x(T.internalFormat,de,fe,T.colorSpace,T.isVideoTexture);X(D,T);let Ae=T.mipmaps,Ne=T.isVideoTexture!==!0,$e=U.__version===void 0||E===!0,it=R.dataReady,nt=L(T,W);if(T.isDepthTexture)be=b(T.format===Ms,T.type),$e&&(Ne?t.texStorage2D(i.TEXTURE_2D,1,be,W.width,W.height):t.texImage2D(i.TEXTURE_2D,0,be,W.width,W.height,0,de,fe,null));else if(T.isDataTexture)if(Ae.length>0){Ne&&$e&&t.texStorage2D(i.TEXTURE_2D,nt,be,Ae[0].width,Ae[0].height);for(let xe=0,Ie=Ae.length;xe<Ie;xe++)he=Ae[xe],Ne?it&&t.texSubImage2D(i.TEXTURE_2D,xe,0,0,he.width,he.height,de,fe,he.data):t.texImage2D(i.TEXTURE_2D,xe,be,he.width,he.height,0,de,fe,he.data);T.generateMipmaps=!1}else Ne?($e&&t.texStorage2D(i.TEXTURE_2D,nt,be,W.width,W.height),it&&(function(xe,Ie,ze,Ct){let we=xe.updateRanges;if(we.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,Ie.width,Ie.height,ze,Ct,Ie.data);else{we.sort((N,Lt)=>N.start-Lt.start);let rt=0;for(let N=1;N<we.length;N++){let Lt=we[rt],Tt=we[N],lt=Lt.start+Lt.count,mn=ie(Tt.start,Ie.width,4),qn=ie(Lt.start,Ie.width,4);Tt.start<=lt+1&&mn===qn&&ie(Tt.start+Tt.count-1,Ie.width,4)===mn?Lt.count=Math.max(Lt.count,Tt.start+Tt.count-Lt.start):(++rt,we[rt]=Tt)}we.length=rt+1;let Xe=i.getParameter(i.UNPACK_ROW_LENGTH),tn=i.getParameter(i.UNPACK_SKIP_PIXELS),ot=i.getParameter(i.UNPACK_SKIP_ROWS);i.pixelStorei(i.UNPACK_ROW_LENGTH,Ie.width);for(let N=0,Lt=we.length;N<Lt;N++){let Tt=we[N],lt=Math.floor(Tt.start/4),mn=Math.ceil(Tt.count/4),qn=lt%Ie.width,On=Math.floor(lt/Ie.width),Hr=mn;i.pixelStorei(i.UNPACK_SKIP_PIXELS,qn),i.pixelStorei(i.UNPACK_SKIP_ROWS,On),t.texSubImage2D(i.TEXTURE_2D,0,qn,On,Hr,1,ze,Ct,Ie.data)}xe.clearUpdateRanges(),i.pixelStorei(i.UNPACK_ROW_LENGTH,Xe),i.pixelStorei(i.UNPACK_SKIP_PIXELS,tn),i.pixelStorei(i.UNPACK_SKIP_ROWS,ot)}})(T,W,de,fe)):t.texImage2D(i.TEXTURE_2D,0,be,W.width,W.height,0,de,fe,W.data);else if(T.isCompressedTexture)if(T.isCompressedArrayTexture){Ne&&$e&&t.texStorage3D(i.TEXTURE_2D_ARRAY,nt,be,Ae[0].width,Ae[0].height,W.depth);for(let xe=0,Ie=Ae.length;xe<Ie;xe++)if(he=Ae[xe],T.format!==jn)if(de!==null)if(Ne){if(it)if(T.layerUpdates.size>0){let ze=Rh(he.width,he.height,T.format,T.type);for(let Ct of T.layerUpdates){let we=he.data.subarray(Ct*ze/he.data.BYTES_PER_ELEMENT,(Ct+1)*ze/he.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,xe,0,0,Ct,he.width,he.height,1,de,we)}T.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,xe,0,0,0,he.width,he.height,W.depth,de,he.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,xe,be,he.width,he.height,W.depth,0,he.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ne?it&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,xe,0,0,0,he.width,he.height,W.depth,de,fe,he.data):t.texImage3D(i.TEXTURE_2D_ARRAY,xe,be,he.width,he.height,W.depth,0,de,fe,he.data)}else{Ne&&$e&&t.texStorage2D(i.TEXTURE_2D,nt,be,Ae[0].width,Ae[0].height);for(let xe=0,Ie=Ae.length;xe<Ie;xe++)he=Ae[xe],T.format!==jn?de!==null?Ne?it&&t.compressedTexSubImage2D(i.TEXTURE_2D,xe,0,0,he.width,he.height,de,he.data):t.compressedTexImage2D(i.TEXTURE_2D,xe,be,he.width,he.height,0,he.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ne?it&&t.texSubImage2D(i.TEXTURE_2D,xe,0,0,he.width,he.height,de,fe,he.data):t.texImage2D(i.TEXTURE_2D,xe,be,he.width,he.height,0,de,fe,he.data)}else if(T.isDataArrayTexture)if(Ne){if($e&&t.texStorage3D(i.TEXTURE_2D_ARRAY,nt,be,W.width,W.height,W.depth),it)if(T.layerUpdates.size>0){let xe=Rh(W.width,W.height,T.format,T.type);for(let Ie of T.layerUpdates){let ze=W.data.subarray(Ie*xe/W.data.BYTES_PER_ELEMENT,(Ie+1)*xe/W.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,Ie,W.width,W.height,1,de,fe,ze)}T.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,W.width,W.height,W.depth,de,fe,W.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,be,W.width,W.height,W.depth,0,de,fe,W.data);else if(T.isData3DTexture)Ne?($e&&t.texStorage3D(i.TEXTURE_3D,nt,be,W.width,W.height,W.depth),it&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,W.width,W.height,W.depth,de,fe,W.data)):t.texImage3D(i.TEXTURE_3D,0,be,W.width,W.height,W.depth,0,de,fe,W.data);else if(T.isFramebufferTexture){if($e)if(Ne)t.texStorage2D(i.TEXTURE_2D,nt,be,W.width,W.height);else{let xe=W.width,Ie=W.height;for(let ze=0;ze<nt;ze++)t.texImage2D(i.TEXTURE_2D,ze,be,xe,Ie,0,de,fe,null),xe>>=1,Ie>>=1}}else if(Ae.length>0){if(Ne&&$e){let xe=Ve(Ae[0]);t.texStorage2D(i.TEXTURE_2D,nt,be,xe.width,xe.height)}for(let xe=0,Ie=Ae.length;xe<Ie;xe++)he=Ae[xe],Ne?it&&t.texSubImage2D(i.TEXTURE_2D,xe,0,0,de,fe,he):t.texImage2D(i.TEXTURE_2D,xe,be,de,fe,he);T.generateMipmaps=!1}else if(Ne){if($e){let xe=Ve(W);t.texStorage2D(i.TEXTURE_2D,nt,be,xe.width,xe.height)}it&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,de,fe,W)}else t.texImage2D(i.TEXTURE_2D,0,be,de,fe,W);m(T)&&g(D),U.__version=R.version,T.onUpdate&&T.onUpdate(T)}w.__version=T.version}function ae(w,T,H,D,E,R){let U=a.convert(H.format,H.colorSpace),P=a.convert(H.type),te=x(H.internalFormat,U,P,H.colorSpace),V=n.get(T),W=n.get(H);if(W.__renderTarget=T,!V.__hasExternalTextures){let de=Math.max(1,T.width>>R),fe=Math.max(1,T.height>>R);E===i.TEXTURE_3D||E===i.TEXTURE_2D_ARRAY?t.texImage3D(E,R,te,de,fe,T.depth,0,U,P,null):t.texImage2D(E,R,te,de,fe,0,U,P,null)}t.bindFramebuffer(i.FRAMEBUFFER,w),me(T)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,D,E,W.__webglTexture,0,ge(T)):(E===i.TEXTURE_2D||E>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&E<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,D,E,W.__webglTexture,R),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Se(w,T,H){if(i.bindRenderbuffer(i.RENDERBUFFER,w),T.depthBuffer){let D=T.depthTexture,E=D&&D.isDepthTexture?D.type:null,R=b(T.stencilBuffer,E),U=T.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,P=ge(T);me(T)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,P,R,T.width,T.height):H?i.renderbufferStorageMultisample(i.RENDERBUFFER,P,R,T.width,T.height):i.renderbufferStorage(i.RENDERBUFFER,R,T.width,T.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,U,i.RENDERBUFFER,w)}else{let D=T.textures;for(let E=0;E<D.length;E++){let R=D[E],U=a.convert(R.format,R.colorSpace),P=a.convert(R.type),te=x(R.internalFormat,U,P,R.colorSpace),V=ge(T);H&&me(T)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,V,te,T.width,T.height):me(T)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,V,te,T.width,T.height):i.renderbufferStorage(i.RENDERBUFFER,te,T.width,T.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Pe(w,T){if(T&&T.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(i.FRAMEBUFFER,w),!T.depthTexture||!T.depthTexture.isDepthTexture)throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let H=n.get(T.depthTexture);H.__renderTarget=T,H.__webglTexture&&T.depthTexture.image.width===T.width&&T.depthTexture.image.height===T.height||(T.depthTexture.image.width=T.width,T.depthTexture.image.height=T.height,T.depthTexture.needsUpdate=!0),j(T.depthTexture,0);let D=H.__webglTexture,E=ge(T);if(T.depthTexture.format===Es)me(T)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,D,0,E):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,D,0);else{if(T.depthTexture.format!==Ms)throw new Error("Unknown depthTexture format");me(T)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,D,0,E):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,D,0)}}function ve(w){let T=n.get(w),H=w.isWebGLCubeRenderTarget===!0;if(T.__boundDepthTexture!==w.depthTexture){let D=w.depthTexture;if(T.__depthDisposeCallback&&T.__depthDisposeCallback(),D){let E=()=>{delete T.__boundDepthTexture,delete T.__depthDisposeCallback,D.removeEventListener("dispose",E)};D.addEventListener("dispose",E),T.__depthDisposeCallback=E}T.__boundDepthTexture=D}if(w.depthTexture&&!T.__autoAllocateDepthBuffer){if(H)throw new Error("target.depthTexture not supported in Cube render targets");let D=w.texture.mipmaps;D&&D.length>0?Pe(T.__webglFramebuffer[0],w):Pe(T.__webglFramebuffer,w)}else if(H){T.__webglDepthbuffer=[];for(let D=0;D<6;D++)if(t.bindFramebuffer(i.FRAMEBUFFER,T.__webglFramebuffer[D]),T.__webglDepthbuffer[D]===void 0)T.__webglDepthbuffer[D]=i.createRenderbuffer(),Se(T.__webglDepthbuffer[D],w,!1);else{let E=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,R=T.__webglDepthbuffer[D];i.bindRenderbuffer(i.RENDERBUFFER,R),i.framebufferRenderbuffer(i.FRAMEBUFFER,E,i.RENDERBUFFER,R)}}else{let D=w.texture.mipmaps;if(D&&D.length>0?t.bindFramebuffer(i.FRAMEBUFFER,T.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,T.__webglFramebuffer),T.__webglDepthbuffer===void 0)T.__webglDepthbuffer=i.createRenderbuffer(),Se(T.__webglDepthbuffer,w,!1);else{let E=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,R=T.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,R),i.framebufferRenderbuffer(i.FRAMEBUFFER,E,i.RENDERBUFFER,R)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}let Re=[],ue=[];function ge(w){return Math.min(r.maxSamples,w.samples)}function me(w){let T=n.get(w);return w.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&T.__useRenderToTexture!==!1}function De(w,T){let H=w.colorSpace,D=w.format,E=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||H!==ti&&H!==di&&(st.getTransfer(H)===vt?D===jn&&E===or||console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",H)),T}function Ve(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(l.width=w.naturalWidth||w.width,l.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(l.width=w.displayWidth,l.height=w.displayHeight):(l.width=w.width,l.height=w.height),l}this.allocateTextureUnit=function(){let w=F;return w>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+w+" texture units while this GPU supports only "+r.maxTextures),F+=1,w},this.resetTextureUnits=function(){F=0},this.setTexture2D=j,this.setTexture2DArray=function(w,T){let H=n.get(w);w.isRenderTargetTexture===!1&&w.version>0&&H.__version!==w.version?pe(H,w,T):t.bindTexture(i.TEXTURE_2D_ARRAY,H.__webglTexture,i.TEXTURE0+T)},this.setTexture3D=function(w,T){let H=n.get(w);w.isRenderTargetTexture===!1&&w.version>0&&H.__version!==w.version?pe(H,w,T):t.bindTexture(i.TEXTURE_3D,H.__webglTexture,i.TEXTURE0+T)},this.setTextureCube=function(w,T){let H=n.get(w);w.version>0&&H.__version!==w.version?(function(D,E,R){if(E.image.length!==6)return;let U=Q(D,E),P=E.source;t.bindTexture(i.TEXTURE_CUBE_MAP,D.__webglTexture,i.TEXTURE0+R);let te=n.get(P);if(P.version!==te.__version||U===!0){t.activeTexture(i.TEXTURE0+R);let V=st.getPrimaries(st.workingColorSpace),W=E.colorSpace===di?null:st.getPrimaries(E.colorSpace),de=E.colorSpace===di||V===W?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,E.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,E.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,E.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,de);let fe=E.isCompressedTexture||E.image[0].isCompressedTexture,he=E.image[0]&&E.image[0].isDataTexture,be=[];for(let we=0;we<6;we++)be[we]=fe||he?he?E.image[we].image:E.image[we]:_(E.image[we],!0,r.maxCubemapSize),be[we]=De(E,be[we]);let Ae=be[0],Ne=a.convert(E.format,E.colorSpace),$e=a.convert(E.type),it=x(E.internalFormat,Ne,$e,E.colorSpace),nt=E.isVideoTexture!==!0,xe=te.__version===void 0||U===!0,Ie=P.dataReady,ze,Ct=L(E,Ae);if(X(i.TEXTURE_CUBE_MAP,E),fe){nt&&xe&&t.texStorage2D(i.TEXTURE_CUBE_MAP,Ct,it,Ae.width,Ae.height);for(let we=0;we<6;we++){ze=be[we].mipmaps;for(let rt=0;rt<ze.length;rt++){let Xe=ze[rt];E.format!==jn?Ne!==null?nt?Ie&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt,0,0,Xe.width,Xe.height,Ne,Xe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt,it,Xe.width,Xe.height,0,Xe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):nt?Ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt,0,0,Xe.width,Xe.height,Ne,$e,Xe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt,it,Xe.width,Xe.height,0,Ne,$e,Xe.data)}}}else{if(ze=E.mipmaps,nt&&xe){ze.length>0&&Ct++;let we=Ve(be[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,Ct,it,we.width,we.height)}for(let we=0;we<6;we++)if(he){nt?Ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,0,0,0,be[we].width,be[we].height,Ne,$e,be[we].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,0,it,be[we].width,be[we].height,0,Ne,$e,be[we].data);for(let rt=0;rt<ze.length;rt++){let Xe=ze[rt].image[we].image;nt?Ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt+1,0,0,Xe.width,Xe.height,Ne,$e,Xe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt+1,it,Xe.width,Xe.height,0,Ne,$e,Xe.data)}}else{nt?Ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,0,0,0,Ne,$e,be[we]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,0,it,Ne,$e,be[we]);for(let rt=0;rt<ze.length;rt++){let Xe=ze[rt];nt?Ie&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt+1,0,0,Ne,$e,Xe.image[we]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+we,rt+1,it,Ne,$e,Xe.image[we])}}}m(E)&&g(i.TEXTURE_CUBE_MAP),te.__version=P.version,E.onUpdate&&E.onUpdate(E)}D.__version=E.version})(H,w,T):t.bindTexture(i.TEXTURE_CUBE_MAP,H.__webglTexture,i.TEXTURE0+T)},this.rebindTextures=function(w,T,H){let D=n.get(w);T!==void 0&&ae(D.__webglFramebuffer,w,w.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),H!==void 0&&ve(w)},this.setupRenderTarget=function(w){let T=w.texture,H=n.get(w),D=n.get(T);w.addEventListener("dispose",B);let E=w.textures,R=w.isWebGLCubeRenderTarget===!0,U=E.length>1;if(U||(D.__webglTexture===void 0&&(D.__webglTexture=i.createTexture()),D.__version=T.version,s.memory.textures++),R){H.__webglFramebuffer=[];for(let P=0;P<6;P++)if(T.mipmaps&&T.mipmaps.length>0){H.__webglFramebuffer[P]=[];for(let te=0;te<T.mipmaps.length;te++)H.__webglFramebuffer[P][te]=i.createFramebuffer()}else H.__webglFramebuffer[P]=i.createFramebuffer()}else{if(T.mipmaps&&T.mipmaps.length>0){H.__webglFramebuffer=[];for(let P=0;P<T.mipmaps.length;P++)H.__webglFramebuffer[P]=i.createFramebuffer()}else H.__webglFramebuffer=i.createFramebuffer();if(U)for(let P=0,te=E.length;P<te;P++){let V=n.get(E[P]);V.__webglTexture===void 0&&(V.__webglTexture=i.createTexture(),s.memory.textures++)}if(w.samples>0&&me(w)===!1){H.__webglMultisampledFramebuffer=i.createFramebuffer(),H.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,H.__webglMultisampledFramebuffer);for(let P=0;P<E.length;P++){let te=E[P];H.__webglColorRenderbuffer[P]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,H.__webglColorRenderbuffer[P]);let V=a.convert(te.format,te.colorSpace),W=a.convert(te.type),de=x(te.internalFormat,V,W,te.colorSpace,w.isXRRenderTarget===!0),fe=ge(w);i.renderbufferStorageMultisample(i.RENDERBUFFER,fe,de,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+P,i.RENDERBUFFER,H.__webglColorRenderbuffer[P])}i.bindRenderbuffer(i.RENDERBUFFER,null),w.depthBuffer&&(H.__webglDepthRenderbuffer=i.createRenderbuffer(),Se(H.__webglDepthRenderbuffer,w,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(R){t.bindTexture(i.TEXTURE_CUBE_MAP,D.__webglTexture),X(i.TEXTURE_CUBE_MAP,T);for(let P=0;P<6;P++)if(T.mipmaps&&T.mipmaps.length>0)for(let te=0;te<T.mipmaps.length;te++)ae(H.__webglFramebuffer[P][te],w,T,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+P,te);else ae(H.__webglFramebuffer[P],w,T,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+P,0);m(T)&&g(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(U){for(let P=0,te=E.length;P<te;P++){let V=E[P],W=n.get(V),de=i.TEXTURE_2D;(w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(de=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(de,W.__webglTexture),X(de,V),ae(H.__webglFramebuffer,w,V,i.COLOR_ATTACHMENT0+P,de,0),m(V)&&g(de)}t.unbindTexture()}else{let P=i.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(P=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(P,D.__webglTexture),X(P,T),T.mipmaps&&T.mipmaps.length>0)for(let te=0;te<T.mipmaps.length;te++)ae(H.__webglFramebuffer[te],w,T,i.COLOR_ATTACHMENT0,P,te);else ae(H.__webglFramebuffer,w,T,i.COLOR_ATTACHMENT0,P,0);m(T)&&g(P),t.unbindTexture()}w.depthBuffer&&ve(w)},this.updateRenderTargetMipmap=function(w){let T=w.textures;for(let H=0,D=T.length;H<D;H++){let E=T[H];if(m(E)){let R=y(w),U=n.get(E).__webglTexture;t.bindTexture(R,U),g(R),t.unbindTexture()}}},this.updateMultisampleRenderTarget=function(w){if(w.samples>0){if(me(w)===!1){let T=w.textures,H=w.width,D=w.height,E=i.COLOR_BUFFER_BIT,R=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,U=n.get(w),P=T.length>1;if(P)for(let V=0;V<T.length;V++)t.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+V,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,U.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+V,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,U.__webglMultisampledFramebuffer);let te=w.texture.mipmaps;te&&te.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,U.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,U.__webglFramebuffer);for(let V=0;V<T.length;V++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(E|=i.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(E|=i.STENCIL_BUFFER_BIT)),P){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,U.__webglColorRenderbuffer[V]);let W=n.get(T[V]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,W,0)}i.blitFramebuffer(0,0,H,D,0,0,H,D,E,i.NEAREST),c===!0&&(Re.length=0,ue.length=0,Re.push(i.COLOR_ATTACHMENT0+V),w.depthBuffer&&w.resolveDepthBuffer===!1&&(Re.push(R),ue.push(R),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,ue)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,Re))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),P)for(let V=0;V<T.length;V++){t.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+V,i.RENDERBUFFER,U.__webglColorRenderbuffer[V]);let W=n.get(T[V]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,U.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+V,i.TEXTURE_2D,W,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,U.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.resolveDepthBuffer===!1&&c){let T=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[T])}}},this.setupDepthRenderbuffer=ve,this.setupFrameBufferTexture=ae,this.useMultisampledRTT=me}function jg(i,e){return{convert:function(t,n=di){let r,a=st.getTransfer(n);if(t===or)return i.UNSIGNED_BYTE;if(t===cl)return i.UNSIGNED_SHORT_4_4_4_4;if(t===hl)return i.UNSIGNED_SHORT_5_5_5_1;if(t===Wc)return i.UNSIGNED_INT_5_9_9_9_REV;if(t===Xc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(t===zc)return i.BYTE;if(t===Gc)return i.SHORT;if(t===oa)return i.UNSIGNED_SHORT;if(t===ll)return i.INT;if(t===ui)return i.UNSIGNED_INT;if(t===Xn)return i.FLOAT;if(t===la)return i.HALF_FLOAT;if(t===Od)return i.ALPHA;if(t===Bd)return i.RGB;if(t===jn)return i.RGBA;if(t===Es)return i.DEPTH_COMPONENT;if(t===Ms)return i.DEPTH_STENCIL;if(t===ul)return i.RED;if(t===dl)return i.RED_INTEGER;if(t===Fd)return i.RG;if(t===jc)return i.RG_INTEGER;if(t===qc)return i.RGBA_INTEGER;if(t===pl||t===ml||t===fl||t===gl)if(a===vt){if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r===null)return null;if(t===pl)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(t===ml)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(t===fl)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(t===gl)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else{if(r=e.get("WEBGL_compressed_texture_s3tc"),r===null)return null;if(t===pl)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(t===ml)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(t===fl)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(t===gl)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}if(t===Yc||t===Kc||t===Zc||t===Jc){if(r=e.get("WEBGL_compressed_texture_pvrtc"),r===null)return null;if(t===Yc)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(t===Kc)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(t===Zc)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(t===Jc)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}if(t===$c||t===Qc||t===eh){if(r=e.get("WEBGL_compressed_texture_etc"),r===null)return null;if(t===$c||t===Qc)return a===vt?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(t===eh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}if(t===th||t===nh||t===rh||t===ih||t===ah||t===sh||t===oh||t===lh||t===ch||t===hh||t===uh||t===dh||t===ph||t===mh){if(r=e.get("WEBGL_compressed_texture_astc"),r===null)return null;if(t===th)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(t===nh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(t===rh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(t===ih)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(t===ah)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(t===sh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(t===oh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(t===lh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(t===ch)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(t===hh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(t===uh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(t===dh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(t===ph)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(t===mh)return a===vt?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}if(t===fh||t===gh||t===yh){if(r=e.get("EXT_texture_compression_bptc"),r===null)return null;if(t===fh)return a===vt?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(t===gh)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(t===yh)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}if(t===vh||t===_h||t===xh||t===Eh){if(r=e.get("EXT_texture_compression_rgtc"),r===null)return null;if(t===vh)return r.COMPRESSED_RED_RGTC1_EXT;if(t===_h)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(t===xh)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(t===Eh)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}return t===ca?i.UNSIGNED_INT_24_8:i[t]!==void 0?i[t]:null}}}var Vh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Ja(e.texture);e.depthNear===t.depthNear&&e.depthFar===t.depthFar||(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Wn({vertexShader:`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,fragmentShader:`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Bt(new ta(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},zh=class extends tr{constructor(e,t){super();let n=this,r=null,a=1,s=null,o="local-floor",c=1,l=null,h=null,u=null,d=null,p=null,f=null,_=typeof XRWebGLBinding<"u",m=new Vh,g={},y=t.getContextAttributes(),x=null,b=null,L=[],I=[],B=new oe,G=null,F=new Qt;F.viewport=new Rt;let j=new Qt;j.viewport=new Rt;let K=[F,j],z=new Jo,Z=null,X=null;function Q(ue){let ge=I.indexOf(ue.inputSource);if(ge===-1)return;let me=L[ge];me!==void 0&&(me.update(ue.inputSource,ue.frame,l||s),me.dispatchEvent({type:ue.type,data:ue.inputSource}))}function ie(){r.removeEventListener("select",Q),r.removeEventListener("selectstart",Q),r.removeEventListener("selectend",Q),r.removeEventListener("squeeze",Q),r.removeEventListener("squeezestart",Q),r.removeEventListener("squeezeend",Q),r.removeEventListener("end",ie),r.removeEventListener("inputsourceschange",pe);for(let ue=0;ue<L.length;ue++){let ge=I[ue];ge!==null&&(I[ue]=null,L[ue].disconnect(ge))}Z=null,X=null,m.reset();for(let ue in g)delete g[ue];e.setRenderTarget(x),p=null,d=null,u=null,r=null,b=null,Re.stop(),n.isPresenting=!1,e.setPixelRatio(G),e.setSize(B.width,B.height,!1),n.dispatchEvent({type:"sessionend"})}function pe(ue){for(let ge=0;ge<ue.removed.length;ge++){let me=ue.removed[ge],De=I.indexOf(me);De>=0&&(I[De]=null,L[De].disconnect(me))}for(let ge=0;ge<ue.added.length;ge++){let me=ue.added[ge],De=I.indexOf(me);if(De===-1){for(let w=0;w<L.length;w++){if(w>=I.length){I.push(me),De=w;break}if(I[w]===null){I[w]=me,De=w;break}}if(De===-1)break}let Ve=L[De];Ve&&Ve.connect(me)}}this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(ue){let ge=L[ue];return ge===void 0&&(ge=new Zi,L[ue]=ge),ge.getTargetRaySpace()},this.getControllerGrip=function(ue){let ge=L[ue];return ge===void 0&&(ge=new Zi,L[ue]=ge),ge.getGripSpace()},this.getHand=function(ue){let ge=L[ue];return ge===void 0&&(ge=new Zi,L[ue]=ge),ge.getHandSpace()},this.setFramebufferScaleFactor=function(ue){a=ue,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(ue){o=ue,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||s},this.setReferenceSpace=function(ue){l=ue},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u===null&&_&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return f},this.getSession=function(){return r},this.setSession=async function(ue){if(r=ue,r!==null){if(x=e.getRenderTarget(),r.addEventListener("select",Q),r.addEventListener("selectstart",Q),r.addEventListener("selectend",Q),r.addEventListener("squeeze",Q),r.addEventListener("squeezestart",Q),r.addEventListener("squeezeend",Q),r.addEventListener("end",ie),r.addEventListener("inputsourceschange",pe),y.xrCompatible!==!0&&await t.makeXRCompatible(),G=e.getPixelRatio(),e.getSize(B),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let ge=null,me=null,De=null;y.depth&&(De=y.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ge=y.stencil?Ms:Es,me=y.stencil?ca:ui);let Ve={colorFormat:t.RGBA8,depthFormat:De,scaleFactor:a};u=this.getBinding(),d=u.createProjectionLayer(Ve),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),b=new nr(d.textureWidth,d.textureHeight,{format:jn,type:or,depthTexture:new Za(d.textureWidth,d.textureHeight,me,void 0,void 0,void 0,void 0,void 0,void 0,ge),stencilBuffer:y.stencil,colorSpace:e.outputColorSpace,samples:y.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{let ge={antialias:y.antialias,alpha:!0,depth:y.depth,stencil:y.stencil,framebufferScaleFactor:a};p=new XRWebGLLayer(r,t,ge),r.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),b=new nr(p.framebufferWidth,p.framebufferHeight,{format:jn,type:or,colorSpace:e.outputColorSpace,stencilBuffer:y.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}b.isXRRenderTarget=!0,this.setFoveation(c),l=null,s=await r.requestReferenceSpace(o),Re.setContext(r),Re.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};let ae=new M,Se=new M;function Pe(ue,ge){ge===null?ue.matrixWorld.copy(ue.matrix):ue.matrixWorld.multiplyMatrices(ge.matrixWorld,ue.matrix),ue.matrixWorldInverse.copy(ue.matrixWorld).invert()}this.updateCamera=function(ue){if(r===null)return;let ge=ue.near,me=ue.far;m.texture!==null&&(m.depthNear>0&&(ge=m.depthNear),m.depthFar>0&&(me=m.depthFar)),z.near=j.near=F.near=ge,z.far=j.far=F.far=me,Z===z.near&&X===z.far||(r.updateRenderState({depthNear:z.near,depthFar:z.far}),Z=z.near,X=z.far),z.layers.mask=6|ue.layers.mask,F.layers.mask=3&z.layers.mask,j.layers.mask=5&z.layers.mask;let De=ue.parent,Ve=z.cameras;Pe(z,De);for(let w=0;w<Ve.length;w++)Pe(Ve[w],De);Ve.length===2?(function(w,T,H){ae.setFromMatrixPosition(T.matrixWorld),Se.setFromMatrixPosition(H.matrixWorld);let D=ae.distanceTo(Se),E=T.projectionMatrix.elements,R=H.projectionMatrix.elements,U=E[14]/(E[10]-1),P=E[14]/(E[10]+1),te=(E[9]+1)/E[5],V=(E[9]-1)/E[5],W=(E[8]-1)/E[0],de=(R[8]+1)/R[0],fe=U*W,he=U*de,be=D/(-W+de),Ae=be*-W;if(T.matrixWorld.decompose(w.position,w.quaternion,w.scale),w.translateX(Ae),w.translateZ(be),w.matrixWorld.compose(w.position,w.quaternion,w.scale),w.matrixWorldInverse.copy(w.matrixWorld).invert(),E[10]===-1)w.projectionMatrix.copy(T.projectionMatrix),w.projectionMatrixInverse.copy(T.projectionMatrixInverse);else{let Ne=U+be,$e=P+be,it=fe-Ae,nt=he+(D-Ae),xe=te*P/$e*Ne,Ie=V*P/$e*Ne;w.projectionMatrix.makePerspective(it,nt,xe,Ie,Ne,$e),w.projectionMatrixInverse.copy(w.projectionMatrix).invert()}})(z,F,j):z.projectionMatrix.copy(F.projectionMatrix),(function(w,T,H){H===null?w.matrix.copy(T.matrixWorld):(w.matrix.copy(H.matrixWorld),w.matrix.invert(),w.matrix.multiply(T.matrixWorld)),w.matrix.decompose(w.position,w.quaternion,w.scale),w.updateMatrixWorld(!0),w.projectionMatrix.copy(T.projectionMatrix),w.projectionMatrixInverse.copy(T.projectionMatrixInverse),w.isPerspectiveCamera&&(w.fov=2*Xi*Math.atan(1/w.projectionMatrix.elements[5]),w.zoom=1)})(ue,z,De)},this.getCamera=function(){return z},this.getFoveation=function(){if(d!==null||p!==null)return c},this.setFoveation=function(ue){c=ue,d!==null&&(d.fixedFoveation=ue),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=ue)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(z)},this.getCameraTexture=function(ue){return g[ue]};let ve=null,Re=new wp;Re.setAnimationLoop(function(ue,ge){if(h=ge.getViewerPose(l||s),f=ge,h!==null){let me=h.views;p!==null&&(e.setRenderTargetFramebuffer(b,p.framebuffer),e.setRenderTarget(b));let De=!1;me.length!==z.cameras.length&&(z.cameras.length=0,De=!0);for(let w=0;w<me.length;w++){let T=me[w],H=null;if(p!==null)H=p.getViewport(T);else{let E=u.getViewSubImage(d,T);H=E.viewport,w===0&&(e.setRenderTargetTextures(b,E.colorTexture,E.depthStencilTexture),e.setRenderTarget(b))}let D=K[w];D===void 0&&(D=new Qt,D.layers.enable(w),D.viewport=new Rt,K[w]=D),D.matrix.fromArray(T.transform.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale),D.projectionMatrix.fromArray(T.projectionMatrix),D.projectionMatrixInverse.copy(D.projectionMatrix).invert(),D.viewport.set(H.x,H.y,H.width,H.height),w===0&&(z.matrix.copy(D.matrix),z.matrix.decompose(z.position,z.quaternion,z.scale)),De===!0&&z.cameras.push(D)}let Ve=r.enabledFeatures;if(Ve&&Ve.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&_){u=n.getBinding();let w=u.getDepthInformation(me[0]);w&&w.isValid&&w.texture&&m.init(w,r.renderState)}if(Ve&&Ve.includes("camera-access")&&_){e.state.unbindTexture(),u=n.getBinding();for(let w=0;w<me.length;w++){let T=me[w].camera;if(T){let H=g[T];H||(H=new Ja,g[T]=H);let D=u.getCameraImage(T);H.sourceTexture=D}}}}for(let me=0;me<L.length;me++){let De=I[me],Ve=L[me];De!==null&&Ve!==void 0&&Ve.update(De,ge,l||s)}ve&&ve(ue,ge),ge.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ge}),f=null}),this.setAnimationLoop=function(ue){ve=ue},this.dispose=function(){}}},gi=new Pn,qg=new Ke;function Yg(i,e){function t(r,a){r.matrixAutoUpdate===!0&&r.updateMatrix(),a.value.copy(r.matrix)}function n(r,a){r.opacity.value=a.opacity,a.color&&r.diffuse.value.copy(a.color),a.emissive&&r.emissive.value.copy(a.emissive).multiplyScalar(a.emissiveIntensity),a.map&&(r.map.value=a.map,t(a.map,r.mapTransform)),a.alphaMap&&(r.alphaMap.value=a.alphaMap,t(a.alphaMap,r.alphaMapTransform)),a.bumpMap&&(r.bumpMap.value=a.bumpMap,t(a.bumpMap,r.bumpMapTransform),r.bumpScale.value=a.bumpScale,a.side===bn&&(r.bumpScale.value*=-1)),a.normalMap&&(r.normalMap.value=a.normalMap,t(a.normalMap,r.normalMapTransform),r.normalScale.value.copy(a.normalScale),a.side===bn&&r.normalScale.value.negate()),a.displacementMap&&(r.displacementMap.value=a.displacementMap,t(a.displacementMap,r.displacementMapTransform),r.displacementScale.value=a.displacementScale,r.displacementBias.value=a.displacementBias),a.emissiveMap&&(r.emissiveMap.value=a.emissiveMap,t(a.emissiveMap,r.emissiveMapTransform)),a.specularMap&&(r.specularMap.value=a.specularMap,t(a.specularMap,r.specularMapTransform)),a.alphaTest>0&&(r.alphaTest.value=a.alphaTest);let s=e.get(a),o=s.envMap,c=s.envMapRotation;o&&(r.envMap.value=o,gi.copy(c),gi.x*=-1,gi.y*=-1,gi.z*=-1,o.isCubeTexture&&o.isRenderTargetTexture===!1&&(gi.y*=-1,gi.z*=-1),r.envMapRotation.value.setFromMatrix4(qg.makeRotationFromEuler(gi)),r.flipEnvMap.value=o.isCubeTexture&&o.isRenderTargetTexture===!1?-1:1,r.reflectivity.value=a.reflectivity,r.ior.value=a.ior,r.refractionRatio.value=a.refractionRatio),a.lightMap&&(r.lightMap.value=a.lightMap,r.lightMapIntensity.value=a.lightMapIntensity,t(a.lightMap,r.lightMapTransform)),a.aoMap&&(r.aoMap.value=a.aoMap,r.aoMapIntensity.value=a.aoMapIntensity,t(a.aoMap,r.aoMapTransform))}return{refreshFogUniforms:function(r,a){a.color.getRGB(r.fogColor.value,Th(i)),a.isFog?(r.fogNear.value=a.near,r.fogFar.value=a.far):a.isFogExp2&&(r.fogDensity.value=a.density)},refreshMaterialUniforms:function(r,a,s,o,c){a.isMeshBasicMaterial||a.isMeshLambertMaterial?n(r,a):a.isMeshToonMaterial?(n(r,a),(function(l,h){h.gradientMap&&(l.gradientMap.value=h.gradientMap)})(r,a)):a.isMeshPhongMaterial?(n(r,a),(function(l,h){l.specular.value.copy(h.specular),l.shininess.value=Math.max(h.shininess,1e-4)})(r,a)):a.isMeshStandardMaterial?(n(r,a),(function(l,h){l.metalness.value=h.metalness,h.metalnessMap&&(l.metalnessMap.value=h.metalnessMap,t(h.metalnessMap,l.metalnessMapTransform)),l.roughness.value=h.roughness,h.roughnessMap&&(l.roughnessMap.value=h.roughnessMap,t(h.roughnessMap,l.roughnessMapTransform)),h.envMap&&(l.envMapIntensity.value=h.envMapIntensity)})(r,a),a.isMeshPhysicalMaterial&&(function(l,h,u){l.ior.value=h.ior,h.sheen>0&&(l.sheenColor.value.copy(h.sheenColor).multiplyScalar(h.sheen),l.sheenRoughness.value=h.sheenRoughness,h.sheenColorMap&&(l.sheenColorMap.value=h.sheenColorMap,t(h.sheenColorMap,l.sheenColorMapTransform)),h.sheenRoughnessMap&&(l.sheenRoughnessMap.value=h.sheenRoughnessMap,t(h.sheenRoughnessMap,l.sheenRoughnessMapTransform))),h.clearcoat>0&&(l.clearcoat.value=h.clearcoat,l.clearcoatRoughness.value=h.clearcoatRoughness,h.clearcoatMap&&(l.clearcoatMap.value=h.clearcoatMap,t(h.clearcoatMap,l.clearcoatMapTransform)),h.clearcoatRoughnessMap&&(l.clearcoatRoughnessMap.value=h.clearcoatRoughnessMap,t(h.clearcoatRoughnessMap,l.clearcoatRoughnessMapTransform)),h.clearcoatNormalMap&&(l.clearcoatNormalMap.value=h.clearcoatNormalMap,t(h.clearcoatNormalMap,l.clearcoatNormalMapTransform),l.clearcoatNormalScale.value.copy(h.clearcoatNormalScale),h.side===bn&&l.clearcoatNormalScale.value.negate())),h.dispersion>0&&(l.dispersion.value=h.dispersion),h.iridescence>0&&(l.iridescence.value=h.iridescence,l.iridescenceIOR.value=h.iridescenceIOR,l.iridescenceThicknessMinimum.value=h.iridescenceThicknessRange[0],l.iridescenceThicknessMaximum.value=h.iridescenceThicknessRange[1],h.iridescenceMap&&(l.iridescenceMap.value=h.iridescenceMap,t(h.iridescenceMap,l.iridescenceMapTransform)),h.iridescenceThicknessMap&&(l.iridescenceThicknessMap.value=h.iridescenceThicknessMap,t(h.iridescenceThicknessMap,l.iridescenceThicknessMapTransform))),h.transmission>0&&(l.transmission.value=h.transmission,l.transmissionSamplerMap.value=u.texture,l.transmissionSamplerSize.value.set(u.width,u.height),h.transmissionMap&&(l.transmissionMap.value=h.transmissionMap,t(h.transmissionMap,l.transmissionMapTransform)),l.thickness.value=h.thickness,h.thicknessMap&&(l.thicknessMap.value=h.thicknessMap,t(h.thicknessMap,l.thicknessMapTransform)),l.attenuationDistance.value=h.attenuationDistance,l.attenuationColor.value.copy(h.attenuationColor)),h.anisotropy>0&&(l.anisotropyVector.value.set(h.anisotropy*Math.cos(h.anisotropyRotation),h.anisotropy*Math.sin(h.anisotropyRotation)),h.anisotropyMap&&(l.anisotropyMap.value=h.anisotropyMap,t(h.anisotropyMap,l.anisotropyMapTransform))),l.specularIntensity.value=h.specularIntensity,l.specularColor.value.copy(h.specularColor),h.specularColorMap&&(l.specularColorMap.value=h.specularColorMap,t(h.specularColorMap,l.specularColorMapTransform)),h.specularIntensityMap&&(l.specularIntensityMap.value=h.specularIntensityMap,t(h.specularIntensityMap,l.specularIntensityMapTransform))})(r,a,c)):a.isMeshMatcapMaterial?(n(r,a),(function(l,h){h.matcap&&(l.matcap.value=h.matcap)})(r,a)):a.isMeshDepthMaterial?n(r,a):a.isMeshDistanceMaterial?(n(r,a),(function(l,h){let u=e.get(h).light;l.referencePosition.value.setFromMatrixPosition(u.matrixWorld),l.nearDistance.value=u.shadow.camera.near,l.farDistance.value=u.shadow.camera.far})(r,a)):a.isMeshNormalMaterial?n(r,a):a.isLineBasicMaterial?((function(l,h){l.diffuse.value.copy(h.color),l.opacity.value=h.opacity,h.map&&(l.map.value=h.map,t(h.map,l.mapTransform))})(r,a),a.isLineDashedMaterial&&(function(l,h){l.dashSize.value=h.dashSize,l.totalSize.value=h.dashSize+h.gapSize,l.scale.value=h.scale})(r,a)):a.isPointsMaterial?(function(l,h,u,d){l.diffuse.value.copy(h.color),l.opacity.value=h.opacity,l.size.value=h.size*u,l.scale.value=.5*d,h.map&&(l.map.value=h.map,t(h.map,l.uvTransform)),h.alphaMap&&(l.alphaMap.value=h.alphaMap,t(h.alphaMap,l.alphaMapTransform)),h.alphaTest>0&&(l.alphaTest.value=h.alphaTest)})(r,a,s,o):a.isSpriteMaterial?(function(l,h){l.diffuse.value.copy(h.color),l.opacity.value=h.opacity,l.rotation.value=h.rotation,h.map&&(l.map.value=h.map,t(h.map,l.mapTransform)),h.alphaMap&&(l.alphaMap.value=h.alphaMap,t(h.alphaMap,l.alphaMapTransform)),h.alphaTest>0&&(l.alphaTest.value=h.alphaTest)})(r,a):a.isShadowMaterial?(r.color.value.copy(a.color),r.opacity.value=a.opacity):a.isShaderMaterial&&(a.uniformsNeedUpdate=!1)}}}function Kg(i,e,t,n){let r={},a={},s=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function c(u,d,p,f){let _=u.value,m=d+"_"+p;if(f[m]===void 0)return f[m]=typeof _=="number"||typeof _=="boolean"?_:_.clone(),!0;{let g=f[m];if(typeof _=="number"||typeof _=="boolean"){if(g!==_)return f[m]=_,!0}else if(g.equals(_)===!1)return g.copy(_),!0}return!1}function l(u){let d={boundary:0,storage:0};return typeof u=="number"||typeof u=="boolean"?(d.boundary=4,d.storage=4):u.isVector2?(d.boundary=8,d.storage=8):u.isVector3||u.isColor?(d.boundary=16,d.storage=12):u.isVector4?(d.boundary=16,d.storage=16):u.isMatrix3?(d.boundary=48,d.storage=48):u.isMatrix4?(d.boundary=64,d.storage=64):u.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",u),d}function h(u){let d=u.target;d.removeEventListener("dispose",h);let p=s.indexOf(d.__bindingPointIndex);s.splice(p,1),i.deleteBuffer(r[d.id]),delete r[d.id],delete a[d.id]}return{bind:function(u,d){let p=d.program;n.uniformBlockBinding(u,p)},update:function(u,d){let p=r[u.id];p===void 0&&((function(m){let g=m.uniforms,y=0,x=16;for(let L=0,I=g.length;L<I;L++){let B=Array.isArray(g[L])?g[L]:[g[L]];for(let G=0,F=B.length;G<F;G++){let j=B[G],K=Array.isArray(j.value)?j.value:[j.value];for(let z=0,Z=K.length;z<Z;z++){let X=l(K[z]),Q=y%x,ie=Q%X.boundary,pe=Q+ie;y+=ie,pe!==0&&x-pe<X.storage&&(y+=x-pe),j.__data=new Float32Array(X.storage/Float32Array.BYTES_PER_ELEMENT),j.__offset=y,y+=X.storage}}}let b=y%x;b>0&&(y+=x-b),m.__size=y,m.__cache={}})(u),p=(function(m){let g=(function(){for(let L=0;L<o;L++)if(s.indexOf(L)===-1)return s.push(L),L;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0})();m.__bindingPointIndex=g;let y=i.createBuffer(),x=m.__size,b=m.usage;return i.bindBuffer(i.UNIFORM_BUFFER,y),i.bufferData(i.UNIFORM_BUFFER,x,b),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,g,y),y})(u),r[u.id]=p,u.addEventListener("dispose",h));let f=d.program;n.updateUBOMapping(u,f);let _=e.render.frame;a[u.id]!==_&&((function(m){let g=r[m.id],y=m.uniforms,x=m.__cache;i.bindBuffer(i.UNIFORM_BUFFER,g);for(let b=0,L=y.length;b<L;b++){let I=Array.isArray(y[b])?y[b]:[y[b]];for(let B=0,G=I.length;B<G;B++){let F=I[B];if(c(F,b,B,x)===!0){let j=F.__offset,K=Array.isArray(F.value)?F.value:[F.value],z=0;for(let Z=0;Z<K.length;Z++){let X=K[Z],Q=l(X);typeof X=="number"||typeof X=="boolean"?(F.__data[0]=X,i.bufferSubData(i.UNIFORM_BUFFER,j+z,F.__data)):X.isMatrix3?(F.__data[0]=X.elements[0],F.__data[1]=X.elements[1],F.__data[2]=X.elements[2],F.__data[3]=0,F.__data[4]=X.elements[3],F.__data[5]=X.elements[4],F.__data[6]=X.elements[5],F.__data[7]=0,F.__data[8]=X.elements[6],F.__data[9]=X.elements[7],F.__data[10]=X.elements[8],F.__data[11]=0):(X.toArray(F.__data,z),z+=Q.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,j,F.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)})(u),a[u.id]=_)},dispose:function(){for(let u in r)i.deleteBuffer(r[u]);s=[],r={},a={}}}}var El=class{constructor(e={}){let{canvas:t=Kd(),context:n=null,depth:r=!0,stencil:a=!1,alpha:s=!1,antialias:o=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1}=e,p;if(this.isWebGLRenderer=!0,n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=s;let f=new Uint32Array(4),_=new Int32Array(4),m=null,g=null,y=[],x=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=vr,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let b=this,L=!1;this._outputColorSpace=on;let I=0,B=0,G=null,F=-1,j=null,K=new Rt,z=new Rt,Z=null,X=new ke(0),Q=0,ie=t.width,pe=t.height,ae=1,Se=null,Pe=null,ve=new Rt(0,0,ie,pe),Re=new Rt(0,0,ie,pe),ue=!1,ge=new Pr,me=!1,De=!1,Ve=new Ke,w=new M,T=new Rt,H={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},D=!1;function E(){return G===null?ae:1}let R,U,P,te,V,W,de,fe,he,be,Ae,Ne,$e,it,nt,xe,Ie,ze,Ct,we,rt,Xe,tn,ot,N=n;function Lt(A,Y){return t.getContext(A,Y)}try{let A={alpha:!0,depth:r,stencil:a,antialias:o,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"180"}`),t.addEventListener("webglcontextlost",mn,!1),t.addEventListener("webglcontextrestored",qn,!1),t.addEventListener("webglcontextcreationerror",On,!1),N===null){let Y="webgl2";if(N=Lt(Y,A),N===null)throw Lt(Y)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(A){throw console.error("THREE.WebGLRenderer: "+A.message),A}function Tt(){R=new Lf(N),R.init(),Xe=new jg(N,R),U=new wf(N,R,e,Xe),P=new Wg(N,R),U.reversedDepthBuffer&&d&&P.buffers.depth.setReversed(!0),te=new Nf(N),V=new Ng,W=new Xg(N,R,P,V,U,Xe,te),de=new Rf(b),fe=new If(b),he=new Ef(N),tn=new Sf(N,he),be=new Pf(N,he,te,tn),Ae=new Of(N,be,he,te),Ct=new Uf(N,U,W),xe=new Af(V),Ne=new Dg(b,de,fe,R,U,tn,xe),$e=new Yg(b,V),it=new Og,nt=new Vg(R),ze=new bf(b,de,fe,P,Ae,p,c),Ie=new zg(b,Ae,U),ot=new Kg(N,te,U,P),we=new Tf(N,R,te),rt=new Df(N,R,te),te.programs=Ne.programs,b.capabilities=U,b.extensions=R,b.properties=V,b.renderLists=it,b.shadowMap=Ie,b.state=P,b.info=te}Tt();let lt=new zh(b,N);function mn(A){A.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),L=!0}function qn(){console.log("THREE.WebGLRenderer: Context Restored."),L=!1;let A=te.autoReset,Y=Ie.enabled,ne=Ie.autoUpdate,se=Ie.needsUpdate,J=Ie.type;Tt(),te.autoReset=A,Ie.enabled=Y,Ie.autoUpdate=ne,Ie.needsUpdate=se,Ie.type=J}function On(A){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function Hr(A){let Y=A.target;Y.removeEventListener("dispose",Hr),(function(ne){(function(se){let J=V.get(se).programs;J!==void 0&&(J.forEach(function(ce){Ne.releaseProgram(ce)}),se.isShaderMaterial&&Ne.releaseShaderCache(se))})(ne),V.remove(ne)})(Y)}function Vr(A,Y,ne){A.transparent===!0&&A.side===Un&&A.forceSinglePass===!1?(A.side=bn,A.needsUpdate=!0,xr(A,Y,ne),A.side=ia,A.needsUpdate=!0,xr(A,Y,ne),A.side=Un):xr(A,Y,ne)}this.xr=lt,this.getContext=function(){return N},this.getContextAttributes=function(){return N.getContextAttributes()},this.forceContextLoss=function(){let A=R.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){let A=R.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return ae},this.setPixelRatio=function(A){A!==void 0&&(ae=A,this.setSize(ie,pe,!1))},this.getSize=function(A){return A.set(ie,pe)},this.setSize=function(A,Y,ne=!0){lt.isPresenting?console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting."):(ie=A,pe=Y,t.width=Math.floor(A*ae),t.height=Math.floor(Y*ae),ne===!0&&(t.style.width=A+"px",t.style.height=Y+"px"),this.setViewport(0,0,A,Y))},this.getDrawingBufferSize=function(A){return A.set(ie*ae,pe*ae).floor()},this.setDrawingBufferSize=function(A,Y,ne){ie=A,pe=Y,ae=ne,t.width=Math.floor(A*ne),t.height=Math.floor(Y*ne),this.setViewport(0,0,A,Y)},this.getCurrentViewport=function(A){return A.copy(K)},this.getViewport=function(A){return A.copy(ve)},this.setViewport=function(A,Y,ne,se){A.isVector4?ve.set(A.x,A.y,A.z,A.w):ve.set(A,Y,ne,se),P.viewport(K.copy(ve).multiplyScalar(ae).round())},this.getScissor=function(A){return A.copy(Re)},this.setScissor=function(A,Y,ne,se){A.isVector4?Re.set(A.x,A.y,A.z,A.w):Re.set(A,Y,ne,se),P.scissor(z.copy(Re).multiplyScalar(ae).round())},this.getScissorTest=function(){return ue},this.setScissorTest=function(A){P.setScissorTest(ue=A)},this.setOpaqueSort=function(A){Se=A},this.setTransparentSort=function(A){Pe=A},this.getClearColor=function(A){return A.copy(ze.getClearColor())},this.setClearColor=function(){ze.setClearColor(...arguments)},this.getClearAlpha=function(){return ze.getClearAlpha()},this.setClearAlpha=function(){ze.setClearAlpha(...arguments)},this.clear=function(A=!0,Y=!0,ne=!0){let se=0;if(A){let J=!1;if(G!==null){let ce=G.texture.format;J=ce===qc||ce===jc||ce===dl}if(J){let ce=G.texture.type,Ee=ce===or||ce===ui||ce===oa||ce===ca||ce===cl||ce===hl,Te=ze.getClearColor(),Ce=ze.getClearAlpha(),Be=Te.r,Fe=Te.g,Oe=Te.b;Ee?(f[0]=Be,f[1]=Fe,f[2]=Oe,f[3]=Ce,N.clearBufferuiv(N.COLOR,0,f)):(_[0]=Be,_[1]=Fe,_[2]=Oe,_[3]=Ce,N.clearBufferiv(N.COLOR,0,_))}else se|=N.COLOR_BUFFER_BIT}Y&&(se|=N.DEPTH_BUFFER_BIT),ne&&(se|=N.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),N.clear(se)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",mn,!1),t.removeEventListener("webglcontextrestored",qn,!1),t.removeEventListener("webglcontextcreationerror",On,!1),ze.dispose(),it.dispose(),nt.dispose(),V.dispose(),de.dispose(),fe.dispose(),Ae.dispose(),tn.dispose(),ot.dispose(),Ne.dispose(),lt.dispose(),lt.removeEventListener("sessionstart",pa),lt.removeEventListener("sessionend",vi),Kt.stop()},this.renderBufferDirect=function(A,Y,ne,se,J,ce){Y===null&&(Y=H);let Ee=J.isMesh&&J.matrixWorld.determinant()<0,Te=(function(je,xt,at,Ge,Me){xt.isScene!==!0&&(xt=H),W.resetTextureUnits();let Ft=xt.fog,Bn=Ge.isMeshStandardMaterial?xt.environment:null,Fn=G===null?b.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:ti,It=(Ge.isMeshStandardMaterial?fe:de).get(Ge.envMap||Bn),kt=Ge.vertexColors===!0&&!!at.attributes.color&&at.attributes.color.itemSize===4,Ht=!!at.attributes.tangent&&(!!Ge.normalMap||Ge.anisotropy>0),ln=!!at.morphAttributes.position,xi=!!at.morphAttributes.normal,Yn=!!at.morphAttributes.color,kn=vr;Ge.toneMapped&&(G!==null&&G.isXRRenderTarget!==!0||(kn=b.toneMapping));let Wr=at.morphAttributes.position||at.morphAttributes.normal||at.morphAttributes.color,Ei=Wr!==void 0?Wr.length:0,Ze=V.get(Ge),Kn=g.state.lights;if(me===!0&&(De===!0||je!==j)){let hn=je===j&&Ge.id===F;xe.setState(Ge,je,hn)}let mt=!1;Ge.version===Ze.__version?Ze.needsLights&&Ze.lightsStateVersion!==Kn.state.version||Ze.outputColorSpace!==Fn||Me.isBatchedMesh&&Ze.batching===!1?mt=!0:Me.isBatchedMesh||Ze.batching!==!0?Me.isBatchedMesh&&Ze.batchingColor===!0&&Me.colorTexture===null||Me.isBatchedMesh&&Ze.batchingColor===!1&&Me.colorTexture!==null||Me.isInstancedMesh&&Ze.instancing===!1?mt=!0:Me.isInstancedMesh||Ze.instancing!==!0?Me.isSkinnedMesh&&Ze.skinning===!1?mt=!0:Me.isSkinnedMesh||Ze.skinning!==!0?Me.isInstancedMesh&&Ze.instancingColor===!0&&Me.instanceColor===null||Me.isInstancedMesh&&Ze.instancingColor===!1&&Me.instanceColor!==null||Me.isInstancedMesh&&Ze.instancingMorph===!0&&Me.morphTexture===null||Me.isInstancedMesh&&Ze.instancingMorph===!1&&Me.morphTexture!==null||Ze.envMap!==It||Ge.fog===!0&&Ze.fog!==Ft?mt=!0:Ze.numClippingPlanes===void 0||Ze.numClippingPlanes===xe.numPlanes&&Ze.numIntersection===xe.numIntersection?(Ze.vertexAlphas!==kt||Ze.vertexTangents!==Ht||Ze.morphTargets!==ln||Ze.morphNormals!==xi||Ze.morphColors!==Yn||Ze.toneMapping!==kn||Ze.morphTargetsCount!==Ei)&&(mt=!0):mt=!0:mt=!0:mt=!0:mt=!0:(mt=!0,Ze.__version=Ge.version);let Zt=Ze.currentProgram;mt===!0&&(Zt=xr(Ge,xt,Me));let Xr=!1,Mi=!1,nn=!1,ct=Zt.getUniforms(),jt=Ze.uniforms;if(P.useProgram(Zt.program)&&(Xr=!0,Mi=!0,nn=!0),Ge.id!==F&&(F=Ge.id,Mi=!0),Xr||j!==je){P.buffers.depth.getReversed()&&je.reversedDepth!==!0&&(je._reversedDepth=!0,je.updateProjectionMatrix()),ct.setValue(N,"projectionMatrix",je.projectionMatrix),ct.setValue(N,"viewMatrix",je.matrixWorldInverse);let hn=ct.map.cameraPosition;hn!==void 0&&hn.setValue(N,w.setFromMatrixPosition(je.matrixWorld)),U.logarithmicDepthBuffer&&ct.setValue(N,"logDepthBufFC",2/(Math.log(je.far+1)/Math.LN2)),(Ge.isMeshPhongMaterial||Ge.isMeshToonMaterial||Ge.isMeshLambertMaterial||Ge.isMeshBasicMaterial||Ge.isMeshStandardMaterial||Ge.isShaderMaterial)&&ct.setValue(N,"isOrthographic",je.isOrthographicCamera===!0),j!==je&&(j=je,Mi=!0,nn=!0)}if(Me.isSkinnedMesh){ct.setOptional(N,Me,"bindMatrix"),ct.setOptional(N,Me,"bindMatrixInverse");let hn=Me.skeleton;hn&&(hn.boneTexture===null&&hn.computeBoneTexture(),ct.setValue(N,"boneTexture",hn.boneTexture,W))}Me.isBatchedMesh&&(ct.setOptional(N,Me,"batchingTexture"),ct.setValue(N,"batchingTexture",Me._matricesTexture,W),ct.setOptional(N,Me,"batchingIdTexture"),ct.setValue(N,"batchingIdTexture",Me._indirectTexture,W),ct.setOptional(N,Me,"batchingColorTexture"),Me._colorsTexture!==null&&ct.setValue(N,"batchingColorTexture",Me._colorsTexture,W));let fn=at.morphAttributes;fn.position===void 0&&fn.normal===void 0&&fn.color===void 0||Ct.update(Me,at,Zt),(Mi||Ze.receiveShadow!==Me.receiveShadow)&&(Ze.receiveShadow=Me.receiveShadow,ct.setValue(N,"receiveShadow",Me.receiveShadow)),Ge.isMeshGouraudMaterial&&Ge.envMap!==null&&(jt.envMap.value=It,jt.flipEnvMap.value=It.isCubeTexture&&It.isRenderTargetTexture===!1?-1:1),Ge.isMeshStandardMaterial&&Ge.envMap===null&&xt.environment!==null&&(jt.envMapIntensity.value=xt.environmentIntensity),Mi&&(ct.setValue(N,"toneMappingExposure",b.toneMappingExposure),Ze.needsLights&&(cn=nn,(ht=jt).ambientLightColor.needsUpdate=cn,ht.lightProbe.needsUpdate=cn,ht.directionalLights.needsUpdate=cn,ht.directionalLightShadows.needsUpdate=cn,ht.pointLights.needsUpdate=cn,ht.pointLightShadows.needsUpdate=cn,ht.spotLights.needsUpdate=cn,ht.spotLightShadows.needsUpdate=cn,ht.rectAreaLights.needsUpdate=cn,ht.hemisphereLights.needsUpdate=cn),Ft&&Ge.fog===!0&&$e.refreshFogUniforms(jt,Ft),$e.refreshMaterialUniforms(jt,Ge,ae,pe,g.state.transmissionRenderTarget[je.id]),ua.upload(N,Ts(Ze),jt,W));var ht,cn;if(Ge.isShaderMaterial&&Ge.uniformsNeedUpdate===!0&&(ua.upload(N,Ts(Ze),jt,W),Ge.uniformsNeedUpdate=!1),Ge.isSpriteMaterial&&ct.setValue(N,"center",Me.center),ct.setValue(N,"modelViewMatrix",Me.modelViewMatrix),ct.setValue(N,"normalMatrix",Me.normalMatrix),ct.setValue(N,"modelMatrix",Me.matrixWorld),Ge.isShaderMaterial||Ge.isRawShaderMaterial){let hn=Ge.uniformsGroups;for(let ma=0,fa=hn.length;ma<fa;ma++){let bi=hn[ma];ot.update(bi,Zt),ot.bind(bi,Zt)}}return Zt})(A,Y,ne,se,J);P.setMaterial(se,Ee);let Ce=ne.index,Be=1;if(se.wireframe===!0){if(Ce=be.getWireframeAttribute(ne),Ce===void 0)return;Be=2}let Fe=ne.drawRange,Oe=ne.attributes.position,Ue=Fe.start*Be,ut=(Fe.start+Fe.count)*Be;ce!==null&&(Ue=Math.max(Ue,ce.start*Be),ut=Math.min(ut,(ce.start+ce.count)*Be)),Ce!==null?(Ue=Math.max(Ue,0),ut=Math.min(ut,Ce.count)):Oe!=null&&(Ue=Math.max(Ue,0),ut=Math.min(ut,Oe.count));let _t=ut-Ue;if(_t<0||_t===1/0)return;let bt;tn.setup(J,se,Te,ne,Ce);let dt=we;if(Ce!==null&&(bt=he.get(Ce),dt=rt,dt.setIndex(bt)),J.isMesh)se.wireframe===!0?(P.setLineWidth(se.wireframeLinewidth*E()),dt.setMode(N.LINES)):dt.setMode(N.TRIANGLES);else if(J.isLine){let je=se.linewidth;je===void 0&&(je=1),P.setLineWidth(je*E()),J.isLineSegments?dt.setMode(N.LINES):J.isLineLoop?dt.setMode(N.LINE_LOOP):dt.setMode(N.LINE_STRIP)}else J.isPoints?dt.setMode(N.POINTS):J.isSprite&&dt.setMode(N.TRIANGLES);if(J.isBatchedMesh)if(J._multiDrawInstances!==null)ji("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),dt.renderMultiDrawInstances(J._multiDrawStarts,J._multiDrawCounts,J._multiDrawCount,J._multiDrawInstances);else if(R.get("WEBGL_multi_draw"))dt.renderMultiDraw(J._multiDrawStarts,J._multiDrawCounts,J._multiDrawCount);else{let je=J._multiDrawStarts,xt=J._multiDrawCounts,at=J._multiDrawCount,Ge=Ce?he.get(Ce).bytesPerElement:1,Me=V.get(se).currentProgram.getUniforms();for(let Ft=0;Ft<at;Ft++)Me.setValue(N,"_gl_DrawID",Ft),dt.render(je[Ft]/Ge,xt[Ft])}else if(J.isInstancedMesh)dt.renderInstances(Ue,_t,J.count);else if(ne.isInstancedBufferGeometry){let je=ne._maxInstanceCount!==void 0?ne._maxInstanceCount:1/0,xt=Math.min(ne.instanceCount,je);dt.renderInstances(Ue,_t,xt)}else dt.render(Ue,_t)},this.compile=function(A,Y,ne=null){ne===null&&(ne=A),g=nt.get(ne),g.init(Y),x.push(g),ne.traverseVisible(function(J){J.isLight&&J.layers.test(Y.layers)&&(g.pushLight(J),J.castShadow&&g.pushShadow(J))}),A!==ne&&A.traverseVisible(function(J){J.isLight&&J.layers.test(Y.layers)&&(g.pushLight(J),J.castShadow&&g.pushShadow(J))}),g.setupLights();let se=new Set;return A.traverse(function(J){if(!(J.isMesh||J.isPoints||J.isLine||J.isSprite))return;let ce=J.material;if(ce)if(Array.isArray(ce))for(let Ee=0;Ee<ce.length;Ee++){let Te=ce[Ee];Vr(Te,ne,J),se.add(Te)}else Vr(ce,ne,J),se.add(ce)}),g=x.pop(),se},this.compileAsync=function(A,Y,ne=null){let se=this.compile(A,Y,ne);return new Promise(J=>{function ce(){se.forEach(function(Ee){V.get(Ee).currentProgram.isReady()&&se.delete(Ee)}),se.size!==0?setTimeout(ce,10):J(A)}R.get("KHR_parallel_shader_compile")!==null?ce():setTimeout(ce,10)})};let cr=null;function pa(){Kt.stop()}function vi(){Kt.start()}let Kt=new wp;function _i(A,Y,ne,se){if(A.visible===!1)return;if(A.layers.test(Y.layers)){if(A.isGroup)ne=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(Y);else if(A.isLight)g.pushLight(A),A.castShadow&&g.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||ge.intersectsSprite(A)){se&&T.setFromMatrixPosition(A.matrixWorld).applyMatrix4(Ve);let ce=Ae.update(A),Ee=A.material;Ee.visible&&m.push(A,ce,Ee,ne,T.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||ge.intersectsObject(A))){let ce=Ae.update(A),Ee=A.material;if(se&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),T.copy(A.boundingSphere.center)):(ce.boundingSphere===null&&ce.computeBoundingSphere(),T.copy(ce.boundingSphere.center)),T.applyMatrix4(A.matrixWorld).applyMatrix4(Ve)),Array.isArray(Ee)){let Te=ce.groups;for(let Ce=0,Be=Te.length;Ce<Be;Ce++){let Fe=Te[Ce],Oe=Ee[Fe.materialIndex];Oe&&Oe.visible&&m.push(A,ce,Oe,ne,T.z,Fe)}}else Ee.visible&&m.push(A,ce,Ee,ne,T.z,null)}}let J=A.children;for(let ce=0,Ee=J.length;ce<Ee;ce++)_i(J[ce],Y,ne,se)}function zr(A,Y,ne,se){let J=A.opaque,ce=A.transmissive,Ee=A.transparent;g.setupLightsView(ne),me===!0&&xe.setGlobalState(b.clippingPlanes,ne),se&&P.viewport(K.copy(se)),J.length>0&&_r(J,Y,ne),ce.length>0&&_r(ce,Y,ne),Ee.length>0&&_r(Ee,Y,ne),P.buffers.depth.setTest(!0),P.buffers.depth.setMask(!0),P.buffers.color.setMask(!0),P.setPolygonOffset(!1)}function Sn(A,Y,ne,se){if((ne.isScene===!0?ne.overrideMaterial:null)!==null)return;g.state.transmissionRenderTarget[se.id]===void 0&&(g.state.transmissionRenderTarget[se.id]=new nr(1,1,{generateMipmaps:!0,type:R.has("EXT_color_buffer_half_float")||R.has("EXT_color_buffer_float")?la:or,minFilter:hi,samples:4,stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:st.workingColorSpace}));let J=g.state.transmissionRenderTarget[se.id],ce=se.viewport||K;J.setSize(ce.z*b.transmissionResolutionScale,ce.w*b.transmissionResolutionScale);let Ee=b.getRenderTarget(),Te=b.getActiveCubeFace(),Ce=b.getActiveMipmapLevel();b.setRenderTarget(J),b.getClearColor(X),Q=b.getClearAlpha(),Q<1&&b.setClearColor(16777215,.5),b.clear(),D&&ze.render(ne);let Be=b.toneMapping;b.toneMapping=vr;let Fe=se.viewport;if(se.viewport!==void 0&&(se.viewport=void 0),g.setupLightsView(se),me===!0&&xe.setGlobalState(b.clippingPlanes,se),_r(A,ne,se),W.updateMultisampleRenderTarget(J),W.updateRenderTargetMipmap(J),R.has("WEBGL_multisampled_render_to_texture")===!1){let Oe=!1;for(let Ue=0,ut=Y.length;Ue<ut;Ue++){let _t=Y[Ue],bt=_t.object,dt=_t.geometry,je=_t.material,xt=_t.group;if(je.side===Un&&bt.layers.test(se.layers)){let at=je.side;je.side=bn,je.needsUpdate=!0,Tn(bt,ne,se,dt,je,xt),je.side=at,je.needsUpdate=!0,Oe=!0}}Oe===!0&&(W.updateMultisampleRenderTarget(J),W.updateRenderTargetMipmap(J))}b.setRenderTarget(Ee,Te,Ce),b.setClearColor(X,Q),Fe!==void 0&&(se.viewport=Fe),b.toneMapping=Be}function _r(A,Y,ne){let se=Y.isScene===!0?Y.overrideMaterial:null;for(let J=0,ce=A.length;J<ce;J++){let Ee=A[J],Te=Ee.object,Ce=Ee.geometry,Be=Ee.group,Fe=Ee.material;Fe.allowOverride===!0&&se!==null&&(Fe=se),Te.layers.test(ne.layers)&&Tn(Te,Y,ne,Ce,Fe,Be)}}function Tn(A,Y,ne,se,J,ce){A.onBeforeRender(b,Y,ne,se,J,ce),A.modelViewMatrix.multiplyMatrices(ne.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),J.onBeforeRender(b,Y,ne,se,A,ce),J.transparent===!0&&J.side===Un&&J.forceSinglePass===!1?(J.side=bn,J.needsUpdate=!0,b.renderBufferDirect(ne,Y,se,J,A,ce),J.side=ia,J.needsUpdate=!0,b.renderBufferDirect(ne,Y,se,J,A,ce),J.side=Un):b.renderBufferDirect(ne,Y,se,J,A,ce),A.onAfterRender(b,Y,ne,se,J,ce)}function xr(A,Y,ne){Y.isScene!==!0&&(Y=H);let se=V.get(A),J=g.state.lights,ce=g.state.shadowsArray,Ee=J.state.version,Te=Ne.getParameters(A,J.state,ce,Y,ne),Ce=Ne.getProgramCacheKey(Te),Be=se.programs;se.environment=A.isMeshStandardMaterial?Y.environment:null,se.fog=Y.fog,se.envMap=(A.isMeshStandardMaterial?fe:de).get(A.envMap||se.environment),se.envMapRotation=se.environment!==null&&A.envMap===null?Y.environmentRotation:A.envMapRotation,Be===void 0&&(A.addEventListener("dispose",Hr),Be=new Map,se.programs=Be);let Fe=Be.get(Ce);if(Fe!==void 0){if(se.currentProgram===Fe&&se.lightsStateVersion===Ee)return ws(A,Te),Fe}else Te.uniforms=Ne.getUniforms(A),A.onBeforeCompile(Te,b),Fe=Ne.acquireProgram(Te,Ce),Be.set(Ce,Fe),se.uniforms=Te.uniforms;let Oe=se.uniforms;return(A.isShaderMaterial||A.isRawShaderMaterial)&&A.clipping!==!0||(Oe.clippingPlanes=xe.uniform),ws(A,Te),se.needsLights=(function(Ue){return Ue.isMeshLambertMaterial||Ue.isMeshToonMaterial||Ue.isMeshPhongMaterial||Ue.isMeshStandardMaterial||Ue.isShadowMaterial||Ue.isShaderMaterial&&Ue.lights===!0})(A),se.lightsStateVersion=Ee,se.needsLights&&(Oe.ambientLightColor.value=J.state.ambient,Oe.lightProbe.value=J.state.probe,Oe.directionalLights.value=J.state.directional,Oe.directionalLightShadows.value=J.state.directionalShadow,Oe.spotLights.value=J.state.spot,Oe.spotLightShadows.value=J.state.spotShadow,Oe.rectAreaLights.value=J.state.rectArea,Oe.ltc_1.value=J.state.rectAreaLTC1,Oe.ltc_2.value=J.state.rectAreaLTC2,Oe.pointLights.value=J.state.point,Oe.pointLightShadows.value=J.state.pointShadow,Oe.hemisphereLights.value=J.state.hemi,Oe.directionalShadowMap.value=J.state.directionalShadowMap,Oe.directionalShadowMatrix.value=J.state.directionalShadowMatrix,Oe.spotShadowMap.value=J.state.spotShadowMap,Oe.spotLightMatrix.value=J.state.spotLightMatrix,Oe.spotLightMap.value=J.state.spotLightMap,Oe.pointShadowMap.value=J.state.pointShadowMap,Oe.pointShadowMatrix.value=J.state.pointShadowMatrix),se.currentProgram=Fe,se.uniformsList=null,Fe}function Ts(A){if(A.uniformsList===null){let Y=A.currentProgram.getUniforms();A.uniformsList=ua.seqWithValue(Y.seq,A.uniforms)}return A.uniformsList}function ws(A,Y){let ne=V.get(A);ne.outputColorSpace=Y.outputColorSpace,ne.batching=Y.batching,ne.batchingColor=Y.batchingColor,ne.instancing=Y.instancing,ne.instancingColor=Y.instancingColor,ne.instancingMorph=Y.instancingMorph,ne.skinning=Y.skinning,ne.morphTargets=Y.morphTargets,ne.morphNormals=Y.morphNormals,ne.morphColors=Y.morphColors,ne.morphTargetsCount=Y.morphTargetsCount,ne.numClippingPlanes=Y.numClippingPlanes,ne.numIntersection=Y.numClipIntersection,ne.vertexAlphas=Y.vertexAlphas,ne.vertexTangents=Y.vertexTangents,ne.toneMapping=Y.toneMapping}Kt.setAnimationLoop(function(A){cr&&cr(A)}),typeof self<"u"&&Kt.setContext(self),this.setAnimationLoop=function(A){cr=A,lt.setAnimationLoop(A),A===null?Kt.stop():Kt.start()},lt.addEventListener("sessionstart",pa),lt.addEventListener("sessionend",vi),this.render=function(A,Y){if(Y!==void 0&&Y.isCamera!==!0)return void console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");if(L===!0)return;if(A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),Y.parent===null&&Y.matrixWorldAutoUpdate===!0&&Y.updateMatrixWorld(),lt.enabled===!0&&lt.isPresenting===!0&&(lt.cameraAutoUpdate===!0&&lt.updateCamera(Y),Y=lt.getCamera()),A.isScene===!0&&A.onBeforeRender(b,A,Y,G),g=nt.get(A,x.length),g.init(Y),x.push(g),Ve.multiplyMatrices(Y.projectionMatrix,Y.matrixWorldInverse),ge.setFromProjectionMatrix(Ve,yr,Y.reversedDepth),De=this.localClippingEnabled,me=xe.init(this.clippingPlanes,De),m=it.get(A,y.length),m.init(),y.push(m),lt.enabled===!0&&lt.isPresenting===!0){let ce=b.xr.getDepthSensingMesh();ce!==null&&_i(ce,Y,-1/0,b.sortObjects)}_i(A,Y,0,b.sortObjects),m.finish(),b.sortObjects===!0&&m.sort(Se,Pe),D=lt.enabled===!1||lt.isPresenting===!1||lt.hasDepthSensing()===!1,D&&ze.addToRenderList(m,A),this.info.render.frame++,me===!0&&xe.beginShadows();let ne=g.state.shadowsArray;Ie.render(ne,A,Y),me===!0&&xe.endShadows(),this.info.autoReset===!0&&this.info.reset();let se=m.opaque,J=m.transmissive;if(g.setupLights(),Y.isArrayCamera){let ce=Y.cameras;if(J.length>0)for(let Ee=0,Te=ce.length;Ee<Te;Ee++)Sn(se,J,A,ce[Ee]);D&&ze.render(A);for(let Ee=0,Te=ce.length;Ee<Te;Ee++){let Ce=ce[Ee];zr(m,A,Ce,Ce.viewport)}}else J.length>0&&Sn(se,J,A,Y),D&&ze.render(A),zr(m,A,Y);G!==null&&B===0&&(W.updateMultisampleRenderTarget(G),W.updateRenderTargetMipmap(G)),A.isScene===!0&&A.onAfterRender(b,A,Y),tn.resetDefaultState(),F=-1,j=null,x.pop(),x.length>0?(g=x[x.length-1],me===!0&&xe.setGlobalState(b.clippingPlanes,g.state.camera)):g=null,y.pop(),m=y.length>0?y[y.length-1]:null},this.getActiveCubeFace=function(){return I},this.getActiveMipmapLevel=function(){return B},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(A,Y,ne){let se=V.get(A);se.__autoAllocateDepthBuffer=A.resolveDepthBuffer===!1,se.__autoAllocateDepthBuffer===!1&&(se.__useRenderToTexture=!1),V.get(A.texture).__webglTexture=Y,V.get(A.depthTexture).__webglTexture=se.__autoAllocateDepthBuffer?void 0:ne,se.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(A,Y){let ne=V.get(A);ne.__webglFramebuffer=Y,ne.__useDefaultFramebuffer=Y===void 0};let Gr=N.createFramebuffer();this.setRenderTarget=function(A,Y=0,ne=0){G=A,I=Y,B=ne;let se=!0,J=null,ce=!1,Ee=!1;if(A){let Te=V.get(A);if(Te.__useDefaultFramebuffer!==void 0)P.bindFramebuffer(N.FRAMEBUFFER,null),se=!1;else if(Te.__webglFramebuffer===void 0)W.setupRenderTarget(A);else if(Te.__hasExternalTextures)W.rebindTextures(A,V.get(A.texture).__webglTexture,V.get(A.depthTexture).__webglTexture);else if(A.depthBuffer){let Fe=A.depthTexture;if(Te.__boundDepthTexture!==Fe){if(Fe!==null&&V.has(Fe)&&(A.width!==Fe.image.width||A.height!==Fe.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");W.setupDepthRenderbuffer(A)}}let Ce=A.texture;(Ce.isData3DTexture||Ce.isDataArrayTexture||Ce.isCompressedArrayTexture)&&(Ee=!0);let Be=V.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(J=Array.isArray(Be[Y])?Be[Y][ne]:Be[Y],ce=!0):J=A.samples>0&&W.useMultisampledRTT(A)===!1?V.get(A).__webglMultisampledFramebuffer:Array.isArray(Be)?Be[ne]:Be,K.copy(A.viewport),z.copy(A.scissor),Z=A.scissorTest}else K.copy(ve).multiplyScalar(ae).floor(),z.copy(Re).multiplyScalar(ae).floor(),Z=ue;if(ne!==0&&(J=Gr),P.bindFramebuffer(N.FRAMEBUFFER,J)&&se&&P.drawBuffers(A,J),P.viewport(K),P.scissor(z),P.setScissorTest(Z),ce){let Te=V.get(A.texture);N.framebufferTexture2D(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_CUBE_MAP_POSITIVE_X+Y,Te.__webglTexture,ne)}else if(Ee){let Te=Y;for(let Ce=0;Ce<A.textures.length;Ce++){let Be=V.get(A.textures[Ce]);N.framebufferTextureLayer(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0+Ce,Be.__webglTexture,ne,Te)}}else if(A!==null&&ne!==0){let Te=V.get(A.texture);N.framebufferTexture2D(N.FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_2D,Te.__webglTexture,ne)}F=-1},this.readRenderTargetPixels=function(A,Y,ne,se,J,ce,Ee,Te=0){if(!A||!A.isWebGLRenderTarget)return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ce=V.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&Ee!==void 0&&(Ce=Ce[Ee]),Ce){P.bindFramebuffer(N.FRAMEBUFFER,Ce);try{let Be=A.textures[Te],Fe=Be.format,Oe=Be.type;if(!U.textureFormatReadable(Fe))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");if(!U.textureTypeReadable(Oe))return void console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");Y>=0&&Y<=A.width-se&&ne>=0&&ne<=A.height-J&&(A.textures.length>1&&N.readBuffer(N.COLOR_ATTACHMENT0+Te),N.readPixels(Y,ne,se,J,Xe.convert(Fe),Xe.convert(Oe),ce))}finally{let Be=G!==null?V.get(G).__webglFramebuffer:null;P.bindFramebuffer(N.FRAMEBUFFER,Be)}}},this.readRenderTargetPixelsAsync=async function(A,Y,ne,se,J,ce,Ee,Te=0){if(!A||!A.isWebGLRenderTarget)throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ce=V.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&Ee!==void 0&&(Ce=Ce[Ee]),Ce){if(Y>=0&&Y<=A.width-se&&ne>=0&&ne<=A.height-J){P.bindFramebuffer(N.FRAMEBUFFER,Ce);let Be=A.textures[Te],Fe=Be.format,Oe=Be.type;if(!U.textureFormatReadable(Fe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!U.textureTypeReadable(Oe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let Ue=N.createBuffer();N.bindBuffer(N.PIXEL_PACK_BUFFER,Ue),N.bufferData(N.PIXEL_PACK_BUFFER,ce.byteLength,N.STREAM_READ),A.textures.length>1&&N.readBuffer(N.COLOR_ATTACHMENT0+Te),N.readPixels(Y,ne,se,J,Xe.convert(Fe),Xe.convert(Oe),0);let ut=G!==null?V.get(G).__webglFramebuffer:null;P.bindFramebuffer(N.FRAMEBUFFER,ut);let _t=N.fenceSync(N.SYNC_GPU_COMMANDS_COMPLETE,0);return N.flush(),await Zd(N,_t,4),N.bindBuffer(N.PIXEL_PACK_BUFFER,Ue),N.getBufferSubData(N.PIXEL_PACK_BUFFER,0,ce),N.deleteBuffer(Ue),N.deleteSync(_t),ce}throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(A,Y=null,ne=0){let se=Math.pow(2,-ne),J=Math.floor(A.image.width*se),ce=Math.floor(A.image.height*se),Ee=Y!==null?Y.x:0,Te=Y!==null?Y.y:0;W.setTexture2D(A,0),N.copyTexSubImage2D(N.TEXTURE_2D,ne,0,0,Ee,Te,J,ce),P.unbindTexture()};let Tl=N.createFramebuffer(),wl=N.createFramebuffer();this.copyTextureToTexture=function(A,Y,ne=null,se=null,J=0,ce=null){let Ee,Te,Ce,Be,Fe,Oe,Ue,ut,_t;ce===null&&(J!==0?(ji("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),ce=J,J=0):ce=0);let bt=A.isCompressedTexture?A.mipmaps[ce]:A.image;if(ne!==null)Ee=ne.max.x-ne.min.x,Te=ne.max.y-ne.min.y,Ce=ne.isBox3?ne.max.z-ne.min.z:1,Be=ne.min.x,Fe=ne.min.y,Oe=ne.isBox3?ne.min.z:0;else{let kt=Math.pow(2,-J);Ee=Math.floor(bt.width*kt),Te=Math.floor(bt.height*kt),Ce=A.isDataArrayTexture?bt.depth:A.isData3DTexture?Math.floor(bt.depth*kt):1,Be=0,Fe=0,Oe=0}se!==null?(Ue=se.x,ut=se.y,_t=se.z):(Ue=0,ut=0,_t=0);let dt=Xe.convert(Y.format),je=Xe.convert(Y.type),xt;Y.isData3DTexture?(W.setTexture3D(Y,0),xt=N.TEXTURE_3D):Y.isDataArrayTexture||Y.isCompressedArrayTexture?(W.setTexture2DArray(Y,0),xt=N.TEXTURE_2D_ARRAY):(W.setTexture2D(Y,0),xt=N.TEXTURE_2D),N.pixelStorei(N.UNPACK_FLIP_Y_WEBGL,Y.flipY),N.pixelStorei(N.UNPACK_PREMULTIPLY_ALPHA_WEBGL,Y.premultiplyAlpha),N.pixelStorei(N.UNPACK_ALIGNMENT,Y.unpackAlignment);let at=N.getParameter(N.UNPACK_ROW_LENGTH),Ge=N.getParameter(N.UNPACK_IMAGE_HEIGHT),Me=N.getParameter(N.UNPACK_SKIP_PIXELS),Ft=N.getParameter(N.UNPACK_SKIP_ROWS),Bn=N.getParameter(N.UNPACK_SKIP_IMAGES);N.pixelStorei(N.UNPACK_ROW_LENGTH,bt.width),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,bt.height),N.pixelStorei(N.UNPACK_SKIP_PIXELS,Be),N.pixelStorei(N.UNPACK_SKIP_ROWS,Fe),N.pixelStorei(N.UNPACK_SKIP_IMAGES,Oe);let Fn=A.isDataArrayTexture||A.isData3DTexture,It=Y.isDataArrayTexture||Y.isData3DTexture;if(A.isDepthTexture){let kt=V.get(A),Ht=V.get(Y),ln=V.get(kt.__renderTarget),xi=V.get(Ht.__renderTarget);P.bindFramebuffer(N.READ_FRAMEBUFFER,ln.__webglFramebuffer),P.bindFramebuffer(N.DRAW_FRAMEBUFFER,xi.__webglFramebuffer);for(let Yn=0;Yn<Ce;Yn++)Fn&&(N.framebufferTextureLayer(N.READ_FRAMEBUFFER,N.COLOR_ATTACHMENT0,V.get(A).__webglTexture,J,Oe+Yn),N.framebufferTextureLayer(N.DRAW_FRAMEBUFFER,N.COLOR_ATTACHMENT0,V.get(Y).__webglTexture,ce,_t+Yn)),N.blitFramebuffer(Be,Fe,Ee,Te,Ue,ut,Ee,Te,N.DEPTH_BUFFER_BIT,N.NEAREST);P.bindFramebuffer(N.READ_FRAMEBUFFER,null),P.bindFramebuffer(N.DRAW_FRAMEBUFFER,null)}else if(J!==0||A.isRenderTargetTexture||V.has(A)){let kt=V.get(A),Ht=V.get(Y);P.bindFramebuffer(N.READ_FRAMEBUFFER,Tl),P.bindFramebuffer(N.DRAW_FRAMEBUFFER,wl);for(let ln=0;ln<Ce;ln++)Fn?N.framebufferTextureLayer(N.READ_FRAMEBUFFER,N.COLOR_ATTACHMENT0,kt.__webglTexture,J,Oe+ln):N.framebufferTexture2D(N.READ_FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_2D,kt.__webglTexture,J),It?N.framebufferTextureLayer(N.DRAW_FRAMEBUFFER,N.COLOR_ATTACHMENT0,Ht.__webglTexture,ce,_t+ln):N.framebufferTexture2D(N.DRAW_FRAMEBUFFER,N.COLOR_ATTACHMENT0,N.TEXTURE_2D,Ht.__webglTexture,ce),J!==0?N.blitFramebuffer(Be,Fe,Ee,Te,Ue,ut,Ee,Te,N.COLOR_BUFFER_BIT,N.NEAREST):It?N.copyTexSubImage3D(xt,ce,Ue,ut,_t+ln,Be,Fe,Ee,Te):N.copyTexSubImage2D(xt,ce,Ue,ut,Be,Fe,Ee,Te);P.bindFramebuffer(N.READ_FRAMEBUFFER,null),P.bindFramebuffer(N.DRAW_FRAMEBUFFER,null)}else It?A.isDataTexture||A.isData3DTexture?N.texSubImage3D(xt,ce,Ue,ut,_t,Ee,Te,Ce,dt,je,bt.data):Y.isCompressedArrayTexture?N.compressedTexSubImage3D(xt,ce,Ue,ut,_t,Ee,Te,Ce,dt,bt.data):N.texSubImage3D(xt,ce,Ue,ut,_t,Ee,Te,Ce,dt,je,bt):A.isDataTexture?N.texSubImage2D(N.TEXTURE_2D,ce,Ue,ut,Ee,Te,dt,je,bt.data):A.isCompressedTexture?N.compressedTexSubImage2D(N.TEXTURE_2D,ce,Ue,ut,bt.width,bt.height,dt,bt.data):N.texSubImage2D(N.TEXTURE_2D,ce,Ue,ut,Ee,Te,dt,je,bt);N.pixelStorei(N.UNPACK_ROW_LENGTH,at),N.pixelStorei(N.UNPACK_IMAGE_HEIGHT,Ge),N.pixelStorei(N.UNPACK_SKIP_PIXELS,Me),N.pixelStorei(N.UNPACK_SKIP_ROWS,Ft),N.pixelStorei(N.UNPACK_SKIP_IMAGES,Bn),ce===0&&Y.generateMipmaps&&N.generateMipmap(xt),P.unbindTexture()},this.initRenderTarget=function(A){V.get(A).__webglFramebuffer===void 0&&W.setupRenderTarget(A)},this.initTexture=function(A){A.isCubeTexture?W.setTextureCube(A,0):A.isData3DTexture?W.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?W.setTexture2DArray(A,0):W.setTexture2D(A,0),P.unbindTexture()},this.resetState=function(){I=0,B=0,G=null,P.reset(),tn.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return yr}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=st._getDrawingBufferColorSpace(e),t.unpackColorSpace=st._getUnpackColorSpace()}};var Lp={type:"change"},Xh={type:"start"},Dp={type:"end"},bl=new rr,Pp=new Cn,Jg=Math.cos(70*kr.DEG2RAD),Wt=new M,pn=2*Math.PI,Mt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Wh=1e-6,Sl=class extends gs{constructor(e,t=null){super(e,t),this.state=Mt.NONE,this.target=new M,this.cursor=new M,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Nn.ROTATE,MIDDLE:Nn.DOLLY,RIGHT:Nn.PAN},this.touches={ONE:Br.ROTATE,TWO:Br.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new M,this._lastQuaternion=new dn,this._lastTargetPosition=new M,this._quat=new dn().setFromUnitVectors(e.up,new M(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new ra,this._sphericalDelta=new ra,this._scale=1,this._panOffset=new M,this._rotateStart=new oe,this._rotateEnd=new oe,this._rotateDelta=new oe,this._panStart=new oe,this._panEnd=new oe,this._panDelta=new oe,this._dollyStart=new oe,this._dollyEnd=new oe,this._dollyDelta=new oe,this._dollyDirection=new M,this._mouse=new oe,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Qg.bind(this),this._onPointerDown=$g.bind(this),this._onPointerUp=e0.bind(this),this._onContextMenu=o0.bind(this),this._onMouseWheel=r0.bind(this),this._onKeyDown=i0.bind(this),this._onTouchStart=a0.bind(this),this._onTouchMove=s0.bind(this),this._onMouseDown=t0.bind(this),this._onMouseMove=n0.bind(this),this._interceptControlDown=l0.bind(this),this._interceptControlUp=c0.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Lp),this.update(),this.state=Mt.NONE}update(e=null){let t=this.object.position;Wt.copy(t).sub(this.target),Wt.applyQuaternion(this._quat),this._spherical.setFromVector3(Wt),this.autoRotate&&this.state===Mt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=pn:n>Math.PI&&(n-=pn),r<-Math.PI?r+=pn:r>Math.PI&&(r-=pn),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let a=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),a=s!=this._spherical.radius}if(Wt.setFromSpherical(this._spherical),Wt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Wt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){let o=Wt.length();s=this._clampDistance(o*this._scale);let c=o-s;this.object.position.addScaledVector(this._dollyDirection,c),this.object.updateMatrixWorld(),a=!!c}else if(this.object.isOrthographicCamera){let o=new M(this._mouse.x,this._mouse.y,0);o.unproject(this.object);let c=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),a=c!==this.object.zoom;let l=new M(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(o),this.object.updateMatrixWorld(),s=Wt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;s!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position):(bl.origin.copy(this.object.position),bl.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(bl.direction))<Jg?this.object.lookAt(this.target):(Pp.setFromNormalAndCoplanarPoint(this.object.up,this.target),bl.intersectPlane(Pp,this.target))))}else if(this.object.isOrthographicCamera){let s=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom&&(this.object.updateProjectionMatrix(),a=!0)}return this._scale=1,this._performCursorZoom=!1,a||this._lastPosition.distanceToSquared(this.object.position)>Wh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Wh||this._lastTargetPosition.distanceToSquared(this.target)>Wh?(this.dispatchEvent(Lp),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?pn/60*this.autoRotateSpeed*e:pn/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Wt.setFromMatrixColumn(t,0),Wt.multiplyScalar(-e),this._panOffset.add(Wt)}_panUp(e,t){this.screenSpacePanning===!0?Wt.setFromMatrixColumn(t,1):(Wt.setFromMatrixColumn(t,0),Wt.crossVectors(this.object.up,Wt)),Wt.multiplyScalar(e),this._panOffset.add(Wt)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;Wt.copy(r).sub(this.target);let a=Wt.length();a*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*a/n.clientHeight,this.object.matrix),this._panUp(2*t*a/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,a=t-n.top,s=n.width,o=n.height;this._mouse.x=r/s*2-1,this._mouse.y=-(a/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(pn*this._rotateDelta.x/t.clientHeight),this._rotateUp(pn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(pn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-pn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(pn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-pn*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,a=Math.sqrt(n*n+r*r);this._dollyStart.set(0,a)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),r=.5*(e.pageX+n.x),a=.5*(e.pageY+n.y);this._rotateEnd.set(r,a)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(pn*this._rotateDelta.x/t.clientHeight),this._rotateUp(pn*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,a=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,a),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let s=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(s,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new oe,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function $g(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function Qg(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function e0(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Dp),this.state=Mt.NONE;break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function t0(i){let e;switch(i.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Nn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=Mt.DOLLY;break;case Nn.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Mt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Mt.ROTATE}break;case Nn.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=Mt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=Mt.PAN}break;default:this.state=Mt.NONE}this.state!==Mt.NONE&&this.dispatchEvent(Xh)}function n0(i){switch(this.state){case Mt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case Mt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case Mt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function r0(i){this.enabled===!1||this.enableZoom===!1||this.state!==Mt.NONE||(i.preventDefault(),this.dispatchEvent(Xh),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(Dp))}function i0(i){this.enabled!==!1&&this._handleKeyDown(i)}function a0(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case Br.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=Mt.TOUCH_ROTATE;break;case Br.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=Mt.TOUCH_PAN;break;default:this.state=Mt.NONE}break;case 2:switch(this.touches.TWO){case Br.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=Mt.TOUCH_DOLLY_PAN;break;case Br.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=Mt.TOUCH_DOLLY_ROTATE;break;default:this.state=Mt.NONE}break;default:this.state=Mt.NONE}this.state!==Mt.NONE&&this.dispatchEvent(Xh)}function s0(i){switch(this._trackPointer(i),this.state){case Mt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case Mt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case Mt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case Mt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=Mt.NONE}}function o0(i){this.enabled!==!1&&i.preventDefault()}function l0(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function c0(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var h0=`\r
    * { box-sizing: border-box; }\r
    html, body {\r
      width: 100%;\r
      height: 100%;\r
      margin: 0;\r
      overflow: hidden;\r
      background: #fff;\r
      color: #000;\r
      font-family: "Noto Sans SC", "Microsoft YaHei UI", "Segoe UI", sans-serif;\r
    }\r
\r
    #app { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }\r
    #viewport { position: absolute; inset: 0; touch-action: none; cursor: grab; }\r
    #viewport:active { cursor: grabbing; }\r
\r
    .hud {\r
      position: absolute;\r
      z-index: 20;\r
      left: 15px;\r
      top: 14px;\r
      pointer-events: none;\r
      user-select: none;\r
      max-width: min(660px, calc(100vw - 30px));\r
    }\r
\r
    .hud .title {\r
      font-size: 13px;\r
      font-weight: 800;\r
      letter-spacing: 0;\r
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\r
    }\r
\r
    .hud .sub {\r
      margin-top: 6px;\r
      font-size: 11px;\r
      line-height: 1.65;\r
      opacity: .62;\r
    }\r
\r
    .controls {\r
      position: absolute;\r
      z-index: 30;\r
      right: 14px;\r
      top: 14px;\r
      display: flex;\r
      flex-wrap: wrap;\r
      justify-content: flex-end;\r
      gap: 7px;\r
      max-width: min(55vw, 520px);\r
    }\r
\r
    button {\r
      min-height: 40px;\r
      padding: 0 11px;\r
      border: 1px solid #000;\r
      background: rgba(255,255,255,.94);\r
      color: #000;\r
      font: inherit;\r
      font-size: 11px;\r
      cursor: pointer;\r
    }\r
    button:hover, button.active { background: #000; color: #fff; }\r
    button:focus-visible { outline: 2px solid #000; outline-offset: 2px; }\r
\r
    .legend {\r
      position: absolute;\r
      z-index: 20;\r
      left: 15px;\r
      bottom: 13px;\r
      pointer-events: none;\r
      user-select: none;\r
      font-size: 11px;\r
      line-height: 1.65;\r
      opacity: .62;\r
    }\r
\r
    .mobile-input-hint { display: none; }\r
\r
    .tag {\r
      position: absolute;\r
      z-index: 25;\r
      transform: translate(-50%, -50%);\r
      white-space: nowrap;\r
      padding: 3px 5px;\r
      font-size: 10px;\r
      line-height: 1;\r
      color: #000;\r
      background: rgba(255,255,255,.82);\r
      border: 1px solid rgba(0,0,0,.22);\r
      pointer-events: none;\r
      user-select: none;\r
    }\r
\r
    .tag.axis {\r
      border: none;\r
      font-size: 12px;\r
      font-weight: 800;\r
      background: rgba(255,255,255,.9);\r
    }\r
\r
    .hidden { display: none !important; }\r
\r
    .memory-layer-tag {\r
      position: absolute;\r
      z-index: 24;\r
      transform: translate(-50%, -50%);\r
      padding: 4px 7px;\r
      border: 1px solid rgba(0,0,0,.28);\r
      background: rgba(255,255,255,.88);\r
      color: #000;\r
      font-size: 10px;\r
      font-weight: 700;\r
      letter-spacing: 0;\r
      white-space: nowrap;\r
      pointer-events: none;\r
      user-select: none;\r
    }\r
\r
    .kind-event { --memory-layer-tone: #202020; }\r
    .kind-fact { --memory-layer-tone: #707070; }\r
    .kind-schema { --memory-layer-tone: #b8b8b8; }\r
\r
    .memory-layer-tag.kind-event {\r
      color: #111;\r
      border-color: #242424;\r
      background: rgba(250,250,250,.94);\r
    }\r
\r
    .memory-layer-tag.kind-fact {\r
      color: #292929;\r
      border-color: #707070;\r
      background: rgba(239,239,239,.94);\r
    }\r
\r
    .memory-layer-tag.kind-schema {\r
      color: #202020;\r
      border-color: #a4a4a4;\r
      background: rgba(220,220,220,.94);\r
    }\r
\r
    .controls button.kind-event.active { background: #202020; color: #fff; }\r
    .controls button.kind-fact.active { background: #707070; color: #fff; }\r
    .controls button.kind-schema.active { background: #b8b8b8; color: #000; }\r
\r
    #memoryKindLegend {\r
      position: absolute;\r
      z-index: 26;\r
      right: 14px;\r
      bottom: 14px;\r
      display: flex;\r
      flex-wrap: wrap;\r
      justify-content: flex-end;\r
      gap: 6px;\r
      pointer-events: none;\r
      user-select: none;\r
    }\r
\r
    .memory-layer-key {\r
      display: inline-flex;\r
      align-items: center;\r
      gap: 5px;\r
      min-height: 24px;\r
      padding: 3px 6px;\r
      border-left: 3px solid var(--memory-layer-tone, #000);\r
      background: rgba(255,255,255,.84);\r
      color: #000;\r
      font-size: 10px;\r
      line-height: 1;\r
      white-space: nowrap;\r
    }\r
\r
    .memory-layer-key::before {\r
      content: '';\r
      display: inline-block;\r
      width: 8px;\r
      height: 8px;\r
      background: var(--memory-layer-tone, currentColor);\r
    }\r
\r
    .memory-layer-key.kind-event { color: #111; }\r
    .memory-layer-key.kind-event::before {\r
      width: 6px;\r
      height: 6px;\r
      border-radius: 50%;\r
      box-shadow: 4px 0 0 #242424, 8px 0 0 #242424;\r
      margin-right: 8px;\r
    }\r
    .memory-layer-key.kind-fact { color: #333; }\r
    .memory-layer-key.kind-fact::before {\r
      background: transparent;\r
      border: 2px solid #707070;\r
      transform: rotate(45deg);\r
    }\r
    .memory-layer-key.kind-schema { color: #555; }\r
    .memory-layer-key.kind-schema::before {\r
      border: 1px solid #555;\r
      background: #b8b8b8;\r
    }\r
\r
    #memoryPanel {\r
      position: absolute;\r
      z-index: 50;\r
      right: 14px;\r
      top: 128px;\r
      width: min(340px, calc(100vw - 28px));\r
      max-height: calc(100% - 156px);\r
      overflow: auto;\r
      border: 1px solid #000;\r
      background: rgba(255,255,255,.96);\r
      box-shadow: 6px 6px 0 rgba(0,0,0,.08);\r
      padding: 12px;\r
    }\r
\r
    #memoryPanel .panel-head {\r
      display: flex;\r
      align-items: flex-start;\r
      justify-content: space-between;\r
      gap: 10px;\r
      padding-bottom: 9px;\r
      border-bottom: 1px solid rgba(0,0,0,.22);\r
    }\r
\r
    #memoryPanel .panel-kicker {\r
      font-size: 10px;\r
      opacity: .58;\r
      margin-bottom: 4px;\r
    }\r
\r
    #memoryPanel .panel-title {\r
      font-size: 14px;\r
      font-weight: 800;\r
      line-height: 1.35;\r
    }\r
\r
    #memoryPanel .panel-close {\r
      width: 34px;\r
      min-width: 34px;\r
      height: 34px;\r
      min-height: 34px;\r
      padding: 0;\r
      line-height: 32px;\r
    }\r
\r
    #memoryPanel .field {\r
      padding: 9px 0;\r
      border-bottom: 1px dashed rgba(0,0,0,.18);\r
    }\r
\r
    #memoryPanel .field:last-child { border-bottom: none; }\r
\r
    #memoryPanel .field-label {\r
      display: block;\r
      font-size: 9px;\r
      opacity: .50;\r
      margin-bottom: 4px;\r
      letter-spacing: .05em;\r
    }\r
\r
    #memoryPanel .field-value {\r
      font-size: 11px;\r
      line-height: 1.62;\r
      white-space: pre-wrap;\r
      word-break: break-word;\r
    }\r
\r
    #memoryPanel .panel-actions {\r
      display: flex;\r
      gap: 7px;\r
      margin-top: 11px;\r
    }\r
\r
    #memoryPanel .panel-actions button {\r
      flex: 1;\r
      min-width: 0;\r
    }\r
\r
    @media (max-width: 700px) {\r
      .hud { left: 10px; top: 10px; max-width: calc(100vw - 20px); }\r
      .hud .sub { display: none; }\r
      .controls {\r
        left: 10px;\r
        right: 10px;\r
        top: 48px;\r
        max-width: none;\r
        max-height: min(300px, 38vh);\r
        overflow-y: auto;\r
        justify-content: flex-start;\r
        align-content: flex-start;\r
        gap: 5px;\r
        padding: 6px;\r
        border: 1px solid #000;\r
        background: rgba(255,255,255,.92);\r
      }\r
      button { min-height: 38px; padding: 0 9px; }\r
      .legend {\r
        left: 10px;\r
        right: 10px;\r
        bottom: 42px;\r
        font-size: 10px;\r
        line-height: 1.45;\r
      }\r
      .desktop-input-hints,\r
      .desktop-node-hint,\r
      .legend #neuralStatus { display: none; }\r
      .mobile-input-hint { display: block; }\r
\r
      #memoryChainCard {\r
        left: 10px !important;\r
        right: 10px !important;\r
        top: auto !important;\r
        bottom: 120px !important;\r
        width: auto !important;\r
        max-height: calc(38vh + 26px);\r
        overflow: auto;\r
      }\r
\r
      #memoryPanel {\r
        left: 10px;\r
        right: 10px;\r
        top: auto;\r
        bottom: 10px;\r
        width: auto;\r
        max-height: 44%;\r
      }\r
\r
      #memoryKindLegend {\r
        left: 10px;\r
        right: 10px;\r
        bottom: 9px;\r
        justify-content: flex-end;\r
      }\r
    }\r
  `,u0=`\r
<div id="app">\r
  <div id="viewport" aria-label="\u53EF\u65CB\u8F6C\u62D6\u52A8\u7684\u8D85\u7EC6\u4F53\u7D20\u5927\u8111\u4E09\u7EF4\u7A7A\u95F4"></div>\r
\r
  <div class="hud">\r
    <div class="title">[ V13.0 \xB7 CANONICAL L3 / ACTIVATED GRAPH ]</div>\r
    <div class="sub">\r
      \u552F\u4E00\u6743\u5A01\u56FE\u5305\u542B\u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u4E8B\u5B9E\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u6A21\u5F0F\u4E0E\u89C4\u5219\uFF1BDocument / Section / Chunk \u4F5C\u4E3A\u72EC\u7ACB\u8BC1\u636E\u901A\u9053\u3002\u5B8C\u6574\u56FE\u5B9A\u4E49\u53EF\u53C2\u4E0E\u63A8\u7406\u7684\u903B\u8F91\u8303\u56F4\uFF0C\u753B\u9762\u53EA\u52A0\u8F7D\u5F53\u524D\u6FC0\u6D3B\u5B50\u56FE\u4E0E\u8BC1\u660E\u8DEF\u5F84\uFF0C\u4E0D\u628A\u5343\u4E07\u7EA7\u8282\u70B9\u4E00\u6B21\u9001\u5165\u6D4F\u89C8\u5668\u3002\r
      \u9ED1\u8272\u5FAE\u70B9\u8868\u793A\u4E8B\u4EF6\uFF0C\u7070\u8272\u7EBF\u6846\u8868\u793A\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\uFF0C\u6D45\u7070\u591A\u9762\u4F53\u8868\u793A\u6A21\u5F0F\u4E0E\u89C4\u5219\uFF1B\u7070\u9636\u53EA\u7F16\u7801\u5BF9\u8C61\u7C7B\u578B\u548C\u6FC0\u6D3B\u5F3A\u5EA6\uFF0C\u4E0D\u518D\u8868\u793A\u72EC\u7ACB\u77E5\u8BC6\u5C42\u3002\r
    </div>\r
  </div>\r
\r
  <div class="controls">\r
    <button id="resetBtn" type="button">\u590D\u4F4D</button>\r
    <button id="frontBtn" type="button">\u6B63\u9762</button>\r
    <button id="toggleLabelsBtn" class="active" type="button">\u6807\u7B7E\u5F00</button>\r
    <button id="toggleRegionsBtn" class="active" type="button">\u5206\u533A\u5F00</button>\r
    <button id="toggleCoreBtn" class="active" type="button">\u5185\u90E8\u5F00</button>\r
    <button id="toggleGridBtn" class="active" type="button">\u7F51\u683C\u5F00</button>\r
    <button id="toggleNeuralBtn" class="active" type="button">\u795E\u7ECF\u7F51\u7EDC\u5F00</button>\r
    <button id="spontaneousBtn" class="active" type="button">\u81EA\u53D1\u8109\u51B2</button>\r
    <button id="frontalPulseBtn" type="button">\u524D\u989D\u53F6\u6FC0\u6D3B</button>\r
    <button id="hippocampusPulseBtn" type="button">\u6D77\u9A6C\u4F53\u6FC0\u6D3B</button>\r
    <button id="globalPulseBtn" type="button">\u5168\u8111\u6CE2</button>\r
    <button id="toggleMemoryBtn" class="active" type="button">Canonical \u56FE\u5F00</button>\r
    <button id="memoryXrayBtn" class="active" type="button">\u56FE\u8C31\u900F\u89C6\u5F00</button>\r
    <button id="toggleObjectGroupingBtn" type="button" aria-pressed="false">\u5BF9\u8C61\u5206\u7EC4</button>\r
    <button id="toggleEventKindBtn" class="active kind-event" type="button">\u4E8B\u4EF6</button>\r
    <button id="toggleFactKindBtn" class="active kind-fact" type="button">\u5B9E\u4F53 / \u4E8B\u5B9E</button>\r
    <button id="toggleSchemaKindBtn" class="active kind-schema" type="button">\u6A21\u5F0F / \u89C4\u5219</button>\r
    <button id="memoryConsolidateBtn" type="button">\u5199\u5165\u56FE\u8C31</button>\r
    <button id="memoryRetrieveBtn" type="button">\u6FC0\u6D3B\u68C0\u7D22</button>\r
    <button id="memoryExampleBtn" class="active" type="button">\u8BC1\u660E\u8DEF\u5F84</button>\r
    <button id="memoryNextExampleBtn" type="button">\u4E0B\u4E00\u6761</button>\r
    <button id="memoryLoadMoreBtn" class="hidden" type="button">\u7EE7\u7EED\u52A0\u8F7D</button>\r
    <button id="memoryClearExampleBtn" type="button">\u6E05\u9664\u9AD8\u4EAE</button>\r
  </div>\r
\r
  <div class="legend">\r
    <div class="desktop-input-hints">\u5DE6\u952E\u62D6\u52A8\uFF1A\u65CB\u8F6C<br>\u53F3\u952E\u62D6\u52A8\uFF1A\u5E73\u79FB<br>\u6EDA\u8F6E\uFF1A\u7F29\u653E</div>\r
    <div class="mobile-input-hint">\u62D6\u52A8\u65CB\u8F6C \xB7 \u53CC\u6307\u7F29\u653E / \u5E73\u79FB \xB7 \u8F7B\u89E6\u8282\u70B9\u770B\u8BC1\u636E</div>\r
    <div id="neuralStatus">\u795E\u7ECF\u6FC0\u6D3B\uFF1A\u81EA\u53D1\u8109\u51B2</div>\r
    <div id="memoryStatus">Canonical L3\uFF1A\u5B8C\u6574\u56FE \xB7 \u5168\u56FE\u878D\u5408</div>\r
    <div class="desktop-node-hint">\u70B9\u51FB\u8282\u70B9\uFF1A\u67E5\u770B\u7C7B\u578B\u3001\u5173\u7CFB\u4E0E\u8BC1\u636E</div>\r
  </div>\r
\r
  <div id="memoryChainCard" style="\r
    position:absolute;\r
    z-index:42;\r
    left:15px;\r
    top:112px;\r
    width:min(430px,calc(100vw - 30px));\r
    border:1px solid #000;\r
    background:rgba(255,255,255,.94);\r
    padding:10px 11px;\r
    font-size:10px;\r
    line-height:1.55;\r
    pointer-events:none;\r
  ">\r
    <div style="font-weight:800;margin-bottom:6px;">[ \u5F53\u524D\u6FC0\u6D3B\u8BC1\u660E\u8DEF\u5F84 \xB7 CANONICAL L3 ]</div>\r
    <div><b>\u67E5\u8BE2\u951A\u70B9</b>\uFF1A<span id="chainEventText">\u2014</span></div>\r
    <div style="margin:3px 0;">\u2193 \u5173\u7CFB\u6269\u5C55 / \u4E8B\u5B9E\u7EA6\u675F</div>\r
    <div><b>\u5B9E\u4F53 / \u4E8B\u5B9E</b>\uFF1A<span id="chainFactText">\u2014</span></div>\r
    <div style="margin:3px 0;">\u2193 \u89C4\u5219\u5339\u914D / \u63A8\u7406\u8BC1\u660E</div>\r
    <div><b>\u6A21\u5F0F / \u89C4\u5219</b>\uFF1A<span id="chainSchemaText">\u2014</span></div>\r
    <div style="margin:3px 0;">\u2193 EvidenceLink</div>\r
    <div><b>\u8BC1\u636E\u56DE\u6E90</b>\uFF1A<span id="chainEvidenceText">\u2014</span></div>\r
  </div>\r
\r
  <div id="axisX" class="tag axis">X</div>\r
  <div id="axisY" class="tag axis">Y</div>\r
  <div id="axisZ" class="tag axis">Z</div>\r
\r
  <div id="tagPrefrontal" class="tag">\u524D\u989D\u53F6</div>\r
  <div id="tagParietal" class="tag">\u9876\u53F6</div>\r
  <div id="tagTemporal" class="tag">\u989E\u53F6</div>\r
  <div id="tagOccipital" class="tag">\u6795\u53F6</div>\r
  <div id="tagCerebellum" class="tag">\u5C0F\u8111</div>\r
  <div id="tagBrainstem" class="tag">\u8111\u5E72</div>\r
  <div id="tagHippocampus" class="tag">\u6D77\u9A6C\u4F53</div>\r
\r
  <div id="memoryKindEventLabel" class="memory-layer-tag kind-event">L3 \xB7 \u5B8C\u6574\u77E5\u8BC6\u56FE</div>\r
  <div id="memoryKindFactLabel" class="memory-layer-tag kind-fact">L3 \xB7 \u5B9E\u4F53 / \u4E8B\u5B9E</div>\r
  <div id="memoryKindSchemaLabel" class="memory-layer-tag kind-schema">L3 \xB7 \u6A21\u5F0F / \u89C4\u5219</div>\r
\r
  <div id="memoryKindLegend" aria-label="Canonical L3 \u5BF9\u8C61\u7C7B\u578B\u56FE\u4F8B">\r
    <span class="memory-layer-key kind-event">\u4E8B\u4EF6</span>\r
    <span class="memory-layer-key kind-fact">\u5B9E\u4F53 / \u4E8B\u5B9E</span>\r
    <span class="memory-layer-key kind-schema">\u6A21\u5F0F / \u89C4\u5219</span>\r
  </div>\r
\r
  <aside id="memoryPanel" class="hidden" aria-live="polite">\r
    <div class="panel-head">\r
      <div>\r
        <div id="memoryPanelKicker" class="panel-kicker">CANONICAL NODE</div>\r
        <div id="memoryPanelTitle" class="panel-title">\u672A\u9009\u62E9\u8282\u70B9</div>\r
      </div>\r
      <button id="memoryPanelClose" class="panel-close" type="button" aria-label="\u5173\u95ED\u8BE6\u60C5">\xD7</button>\r
    </div>\r
\r
    <div class="field">\r
      <span class="field-label">ID / \u5BF9\u8C61\u7C7B\u578B</span>\r
      <div id="memoryPanelId" class="field-value">\u2014</div>\r
    </div>\r
\r
    <div class="field">\r
      <span class="field-label">\u6458\u8981</span>\r
      <div id="memoryPanelSummary" class="field-value">\u2014</div>\r
    </div>\r
\r
    <div class="field">\r
      <span class="field-label">\u5177\u4F53\u5185\u5BB9</span>\r
      <div id="memoryPanelContent" class="field-value">\u2014</div>\r
    </div>\r
\r
    <div class="field">\r
      <span class="field-label">\u6765\u6E90 / \u65F6\u95F4</span>\r
      <div id="memoryPanelSource" class="field-value">\u2014</div>\r
    </div>\r
\r
    <div class="field">\r
      <span class="field-label">\u5173\u8054\u8282\u70B9</span>\r
      <div id="memoryPanelRelations" class="field-value">\u2014</div>\r
    </div>\r
\r
    <div class="panel-actions">\r
      <button id="focusMemoryNodeBtn" type="button">\u805A\u7126\u8282\u70B9</button>\r
      <button id="traceMemoryNodeBtn" type="button">\u8FFD\u8E2A\u5173\u8054</button>\r
    </div>\r
  </aside>\r
</div>\r
\r
<script type="importmap">\r
{\r
  "imports": {\r
    "three": "/vendor/three/0.180.0/three.module.min.js",\r
    "three/addons/": "/vendor/three/0.180.0/addons/"\r
  }\r
}\r
<\/script>\r
\r
<script type="module">\r
import * as THREE from 'three';\r
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\r
\r
const viewport = document.getElementById('viewport');\r
\r
const qualityPresets = {\r
  high: {\r
    cortexTheta: 166,\r
    cortexPhi: 254,\r
    cortexCube: 0.228,\r
    cerebellumTheta: 58,\r
    cerebellumPhi: 92,\r
    cerebellumCube: 0.255,\r
    neuralNodes: 820,\r
    activeSpheres: 88,\r
    pixelRatioCap: 1.25,\r
    animationFps: 60,\r
    antialias: true\r
  },\r
  balanced: {\r
    cortexTheta: 136,\r
    cortexPhi: 206,\r
    cortexCube: 0.275,\r
    cerebellumTheta: 48,\r
    cerebellumPhi: 74,\r
    cerebellumCube: 0.30,\r
    neuralNodes: 560,\r
    activeSpheres: 56,\r
    pixelRatioCap: 1,\r
    animationFps: 30,\r
    antialias: true\r
  },\r
  low: {\r
    cortexTheta: 104,\r
    cortexPhi: 158,\r
    cortexCube: 0.35,\r
    cerebellumTheta: 38,\r
    cerebellumPhi: 58,\r
    cerebellumCube: 0.37,\r
    neuralNodes: 360,\r
    activeSpheres: 36,\r
    pixelRatioCap: 1,\r
    animationFps: 24,\r
    antialias: false\r
  }\r
};\r
\r
const requestedQuality = new URLSearchParams(window.location.search).get('quality');\r
const lowPowerDevice =\r
  window.matchMedia('(max-width: 700px)').matches ||\r
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||\r
  (navigator.deviceMemory && navigator.deviceMemory <= 4);\r
const qualityName = Object.hasOwn(qualityPresets, requestedQuality)\r
  ? requestedQuality\r
  : (lowPowerDevice ? 'low' : 'balanced');\r
const quality = qualityPresets[qualityName];\r
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\r
\r
window.__brainPerformance = {\r
  profile: qualityName,\r
  reducedMotion,\r
  cortexInstances: 0,\r
  neuralInitialized: false,\r
  neuralNodes: 0,\r
  neuralEdges: 0,\r
  animationProxyAvailable: false,\r
  animationProxyActive: false,\r
  renderCount: 0\r
};\r
\r
const scene = new THREE.Scene();\r
scene.background = new THREE.Color(0xffffff);\r
scene.fog = new THREE.FogExp2(0xffffff, 0.0105);\r
\r
const camera = new THREE.PerspectiveCamera(\r
  42,\r
  window.innerWidth / window.innerHeight,\r
  0.05,\r
  260\r
);\r
\r
// \u521D\u59CB\u4E3A\u63A5\u8FD1\u53C2\u8003\u56FE\u7684\u6B63\u9762\u89C6\u89D2\uFF0C\u5927\u8111\u5360\u753B\u9762\u4E3B\u4F53\u3002\r
camera.position.set(0, 2.4, 44);\r
\r
const renderer = new THREE.WebGLRenderer({\r
  antialias: quality.antialias,\r
  alpha: false,\r
  powerPreference: 'high-performance'\r
});\r
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));\r
renderer.setSize(window.innerWidth, window.innerHeight);\r
renderer.outputColorSpace = THREE.SRGBColorSpace;\r
viewport.appendChild(renderer.domElement);\r
\r
const webgl = renderer.getContext();\r
const standardRendererName = String(webgl.getParameter(webgl.RENDERER) || '');\r
// Firefox \u5DF2\u5F03\u7528\u8C03\u8BD5\u6269\u5C55\u5E76\u76F4\u63A5\u516C\u5F00 RENDERER\uFF1BChromium \u4ECD\u9700\u6269\u5C55\u8BC6\u522B SwiftShader\u3002\r
const debugRendererInfo = /Firefox\\//.test(navigator.userAgent)\r
  ? null\r
  : webgl.getExtension('WEBGL_debug_renderer_info');\r
const rendererName = debugRendererInfo\r
  ? String(webgl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL) || standardRendererName)\r
  : standardRendererName;\r
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);\r
const targetAnimationFps = Math.min(\r
  quality.animationFps,\r
  softwareRenderer ? 12 : quality.animationFps,\r
  reducedMotion ? 15 : quality.animationFps\r
);\r
const animationFrameInterval = 1000 / targetAnimationFps;\r
\r
Object.assign(window.__brainPerformance, {\r
  pixelRatio: renderer.getPixelRatio(),\r
  targetAnimationFps,\r
  renderer: rendererName || 'unknown',\r
  softwareRenderer\r
});\r
\r
const ambient = new THREE.AmbientLight(0xffffff, 1.10);\r
scene.add(ambient);\r
\r
const key = new THREE.DirectionalLight(0xffffff, 1.08);\r
key.position.set(13, 17, 18);\r
scene.add(key);\r
\r
const fill = new THREE.DirectionalLight(0xffffff, 0.30);\r
fill.position.set(-15, 7, 11);\r
scene.add(fill);\r
\r
const rear = new THREE.DirectionalLight(0xffffff, 0.16);\r
rear.position.set(0, 8, -18);\r
scene.add(rear);\r
\r
const controls = new OrbitControls(camera, renderer.domElement);\r
controls.enableDamping = false;\r
controls.enablePan = true;\r
controls.screenSpacePanning = true;\r
controls.minDistance = 20;\r
controls.maxDistance = 95;\r
controls.rotateSpeed = 0.70;\r
controls.zoomSpeed = 0.85;\r
controls.panSpeed = 0.65;\r
controls.target.set(0, 1.1, -0.9);\r
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;\r
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;\r
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;\r
\r
// ---------------------------------------------------------------------\r
// \u65E0\u9650\u611F\u7A00\u758F\u4E09\u7EF4\u7F51\u683C\r
// ---------------------------------------------------------------------\r
const GRID_STEP = 2.5;\r
const HALF_SIZE = 47;\r
\r
function buildGrid() {\r
  const normal = [];\r
  const major = [];\r
\r
  const push = (arr, ax, ay, az, bx, by, bz) => arr.push(ax, ay, az, bx, by, bz);\r
  const isMajor = (v) => Math.abs(v % 10) < 0.001;\r
\r
  for (let a = -HALF_SIZE; a <= HALF_SIZE; a += GRID_STEP) {\r
    for (let b = -HALF_SIZE; b <= HALF_SIZE; b += GRID_STEP) {\r
      const arr = (isMajor(a) || isMajor(b)) ? major : normal;\r
      push(arr, -HALF_SIZE, a, b, HALF_SIZE, a, b);\r
      push(arr, a, -HALF_SIZE, b, a, HALF_SIZE, b);\r
      push(arr, a, b, -HALF_SIZE, a, b, HALF_SIZE);\r
    }\r
  }\r
\r
  const group = new THREE.Group();\r
\r
  const g1 = new THREE.BufferGeometry();\r
  g1.setAttribute('position', new THREE.Float32BufferAttribute(normal, 3));\r
  group.add(new THREE.LineSegments(\r
    g1,\r
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.040 })\r
  ));\r
\r
  const g2 = new THREE.BufferGeometry();\r
  g2.setAttribute('position', new THREE.Float32BufferAttribute(major, 3));\r
  group.add(new THREE.LineSegments(\r
    g2,\r
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.095 })\r
  ));\r
\r
  return group;\r
}\r
\r
const grid = buildGrid();\r
scene.add(grid);\r
\r
// ---------------------------------------------------------------------\r
// \u5750\u6807\u8F74\r
// ---------------------------------------------------------------------\r
const AXIS_LEN = 31;\r
\r
function line(a, b, opacity=0.95) {\r
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);\r
  return new THREE.Line(\r
    geo,\r
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity })\r
  );\r
}\r
\r
scene.add(line(new THREE.Vector3(-AXIS_LEN,0,0), new THREE.Vector3(AXIS_LEN,0,0)));\r
scene.add(line(new THREE.Vector3(0,-AXIS_LEN,0), new THREE.Vector3(0,AXIS_LEN,0)));\r
scene.add(line(new THREE.Vector3(0,0,-AXIS_LEN), new THREE.Vector3(0,0,AXIS_LEN)));\r
\r
const origin = new THREE.Mesh(\r
  new THREE.SphereGeometry(0.035, 10, 10),\r
  new THREE.MeshBasicMaterial({ color: 0x000000 })\r
);\r
scene.add(origin);\r
\r
[\r
  [new THREE.Vector3(1,0,0), new THREE.Vector3(AXIS_LEN-1.1,0,0)],\r
  [new THREE.Vector3(0,1,0), new THREE.Vector3(0,AXIS_LEN-1.1,0)],\r
  [new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,AXIS_LEN-1.1)]\r
].forEach(([dir,pos]) => {\r
  scene.add(new THREE.ArrowHelper(dir, pos, 1.1, 0x000000, 0.30, 0.15));\r
});\r
\r
// ---------------------------------------------------------------------\r
// \u5927\u8111\u53C2\u6570\r
// ---------------------------------------------------------------------\r
const brainRoot = new THREE.Group();\r
brainRoot.scale.set(1.24, 1.24, 1.24);\r
brainRoot.position.set(0, 0.6, 0);\r
scene.add(brainRoot);\r
\r
const regionGray = {\r
  prefrontal: 0xe3e3e3,\r
  parietal: 0xd8d8d8,\r
  temporal: 0xcecece,\r
  occipital: 0xc4c4c4,\r
  cerebellum: 0xb9b9b9,\r
  brainstem: 0xaaaaaa,\r
  hippocampus: 0x9c9c9c\r
};\r
\r
let cortexMeshes = [];\r
let coreMeshes = [];\r
const cortexAnimationPairs = [];\r
const lightweightAnimationReasons = new Set();\r
let labelsVisible = true;\r
let regionsVisible = true;\r
let coreVisible = true;\r
let gridVisible = true;\r
let renderSuspended = false;\r
let scheduledRender = 0;\r
\r
function createCortexAnimationProxy(mesh, points, pointSize, shadeForPoint=()=>1) {\r
  if (!softwareRenderer || !points.length) return;\r
\r
  const sampleStride = 4;\r
  const sampleCount = Math.ceil(points.length / sampleStride);\r
  const positions = new Float32Array(sampleCount * 3);\r
  const shades = new Float32Array(sampleCount * 3);\r
\r
  for (let source = 0, target = 0; source < points.length; source += sampleStride, target++) {\r
    const p = points[source];\r
    const shade = shadeForPoint(p);\r
    positions[target*3] = p.x;\r
    positions[target*3+1] = p.y;\r
    positions[target*3+2] = p.z;\r
    shades[target*3] = shade;\r
    shades[target*3+1] = shade;\r
    shades[target*3+2] = shade;\r
  }\r
\r
  const geometry = new THREE.BufferGeometry();\r
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));\r
  geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));\r
\r
  const proxy = new THREE.Points(\r
    geometry,\r
    new THREE.PointsMaterial({\r
      color: regionGray[mesh.userData.region],\r
      size: pointSize * 1.65,\r
      vertexColors: true,\r
      transparent: true,\r
      opacity: 0.34,\r
      sizeAttenuation: true,\r
      depthWrite: false\r
    })\r
  );\r
  proxy.visible = false;\r
  proxy.renderOrder = 3;\r
  proxy.userData.region = mesh.userData.region;\r
  brainRoot.add(proxy);\r
  cortexAnimationPairs.push({ mesh, proxy });\r
  window.__brainPerformance.animationProxyAvailable = true;\r
}\r
\r
function setLightweightAnimation(reason, active) {\r
  if (!softwareRenderer) return;\r
\r
  if (active) lightweightAnimationReasons.add(reason);\r
  else lightweightAnimationReasons.delete(reason);\r
\r
  const proxyActive = lightweightAnimationReasons.size > 0;\r
  cortexAnimationPairs.forEach(({mesh, proxy}) => {\r
    mesh.visible = !proxyActive;\r
    proxy.visible = proxyActive;\r
  });\r
  window.__brainPerformance.animationProxyActive = proxyActive;\r
}\r
\r
// ---------------------------------------------------------------------\r
// \u76AE\u5C42\u66F2\u9762\uFF1A\u7528\u53C2\u6570\u5316\u8868\u9762\u76F4\u63A5\u94FA\u8BBE\u8D85\u7EC6\u5C0F\u65B9\u5757\u3002\r
// \u76F8\u6BD4\u5168\u4F53\u79EF\u66B4\u529B\u626B\u63CF\uFF0C\u8FD9\u6837\u80FD\u628A\u66F4\u591A\u65B9\u5757\u96C6\u4E2D\u5230\u771F\u6B63\u53EF\u89C1\u7684\u76AE\u5C42\u3002\r
// ---------------------------------------------------------------------\r
function cortexRegion(x, y, z) {\r
  if (z > 4.8 && y > -1.2) return 'prefrontal';\r
  if (z < -6.2 && y > -1.4) return 'occipital';\r
  if (y < 2.0 && Math.abs(x) > 4.2 && z > -5.2) return 'temporal';\r
  if (y > 4.8 && z > -5.8) return 'parietal';\r
  return 'parietal';\r
}\r
\r
function corticalField(theta, phi, side, xN, yN, zN) {\r
  const superior = clamp01((yN + 1.0) * 0.5);\r
  const lateral = clamp01(Math.abs(xN));\r
  const frontal = clamp01((zN + 1.0) * 0.5);\r
  const occipital = clamp01((-zN + 1.0) * 0.5);\r
  const inferior = clamp01((-yN + 1.0) * 0.5);\r
\r
  const prefrontalW = frontal * (0.34 + 0.66 * lateral) * (0.50 + 0.50 * superior);\r
  const parietalW = superior * (1.0 - frontal * 0.26) * (1.0 - occipital * 0.20);\r
  const temporalW = inferior * lateral * (0.72 + 0.28 * frontal);\r
  const occipitalW = occipital * (0.54 + 0.46 * superior);\r
\r
  // \u524D\u989D\u53F6\uFF1A\u7AD6\u5411\u3001\u6247\u5F62\u3001\u957F\u77ED\u4EA4\u66FF\r
  const prefrontal =\r
    0.20 * Math.sin((zN * 5.0 - yN * 1.15 + side * 0.13) * Math.PI) +\r
    0.105 * Math.sin((zN * 8.6 + xN * 1.10 - yN * 0.45) * Math.PI) +\r
    0.050 * Math.sin((zN * 13.5 + xN * 2.1) * Math.PI);\r
\r
  // \u9876\u53F6\uFF1A\u524D\u540E\u5411\u957F\u56DE + \u6B21\u7EA7\u6A2A\u7EB9\r
  const parietal =\r
    0.235 * Math.sin((xN * 4.45 + zN * 0.46 + side * 0.10) * Math.PI) +\r
    0.105 * Math.sin((xN * 7.9 - zN * 0.85 + yN * 0.33) * Math.PI) +\r
    0.047 * Math.sin((xN * 13.1 + zN * 1.75) * Math.PI);\r
\r
  // \u989E\u53F6\uFF1A\u6C34\u5E73\u5F27\u5F62\u6C9F\u56DE\u4E3A\u4E3B\r
  const temporal =\r
    0.195 * Math.sin((yN * 3.15 + zN * 2.48 + xN * 0.33) * Math.PI) +\r
    0.092 * Math.sin((zN * 5.35 - yN * 1.12 - side * 0.16) * Math.PI) +\r
    0.042 * Math.sin((zN * 9.2 + yN * 2.6) * Math.PI);\r
\r
  // \u6795\u53F6\uFF1A\u8F83\u77ED\u3001\u8F83\u5BC6\u3001\u66F4\u788E\r
  const occipitalF =\r
    0.145 * Math.sin((xN * 2.65 - zN * 3.85) * Math.PI) +\r
    0.088 * Math.sin((xN * 4.10 - zN * 6.85 + yN * 0.42) * Math.PI) +\r
    0.040 * Math.sin((xN * 7.8 - zN * 11.0) * Math.PI);\r
\r
  return prefrontalW * prefrontal +\r
         parietalW * parietal +\r
         temporalW * temporal +\r
         occipitalW * occipitalF;\r
}\r
\r
function gauss(v, center, width) {\r
  const d = (v - center) / width;\r
  return Math.exp(-d * d);\r
}\r
\r
function clamp01(v) {\r
  return Math.min(1, Math.max(0, v));\r
}\r
\r
function smoothstep(edge0, edge1, x) {\r
  const t = clamp01((x - edge0) / (edge1 - edge0));\r
  return t * t * (3 - 2 * t);\r
}\r
\r
function groove(distance, width) {\r
  const d = distance / width;\r
  return Math.exp(-d * d);\r
}\r
\r
function ridge(distance, width) {\r
  const d = distance / width;\r
  return Math.exp(-d * d);\r
}\r
\r
function buildCortexHemisphere(side) {\r
  const thetaSteps = quality.cortexTheta;\r
  const phiBaseSteps = quality.cortexPhi;\r
  const cubeSize = quality.cortexCube;\r
  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);\r
\r
  const byRegion = {\r
    prefrontal: [],\r
    parietal: [],\r
    temporal: [],\r
    occipital: []\r
  };\r
\r
  for (let ti = 0; ti < thetaSteps; ti++) {\r
    const theta = Math.PI * ti / (thetaSteps - 1);\r
    const sinT = Math.sin(theta);\r
    const cosT = Math.cos(theta);\r
\r
    const ringCount = Math.max(1, Math.round(phiBaseSteps * Math.max(0.036, sinT)));\r
    const phiOffset = (ti % 2) * Math.PI / Math.max(3, ringCount);\r
\r
    for (let pi = 0; pi < ringCount; pi++) {\r
      const phi = (Math.PI * 2 * pi / ringCount) + phiOffset;\r
      const cosP = Math.cos(phi);\r
      const sinP = Math.sin(phi);\r
\r
      // \u6B63\u9762\u8F6E\u5ED3\u66F4\u63A5\u8FD1\u53C2\u8003\u56FE\uFF1A\u4E3B\u4F53\u66F4\u5706\u6DA6\uFF0C\u9876\u90E8\u66F4\u9AD8\uFF0C\u5DE6\u53F3\u5BF9\u79F0\u66F4\u597D\u3002\r
      let rx = 9.2;\r
      let ry = 12.0;\r
      let rz = 9.8;\r
\r
      const lower = Math.max(0, -cosT);\r
      rx *= 1.0 - lower * 0.13;\r
      rz *= 1.0 - lower * 0.10;\r
\r
      const frontBias = Math.max(0, sinP);\r
      const backBias = Math.max(0, -sinP);\r
      rz *= 1.0 + frontBias * 0.09 - backBias * 0.05;\r
\r
      // \u9876\u53F6-\u989D\u53F6\u9876\u51A0\u7A0D\u9971\u6EE1\uFF0C\u989E\u4E0B\u90E8\u7A0D\u5185\u6536\r
      const superiorBoost = Math.max(0, cosT);\r
      rx *= 1.0 + superiorBoost * 0.03;\r
      ry *= 1.0 + superiorBoost * 0.02;\r
\r
      const centerX = side * 5.15;\r
\r
      let x = centerX + rx * sinT * cosP;\r
      let y = 2.65 + ry * cosT;\r
      let z = rz * sinT * sinP;\r
\r
      // \u66F4\u81EA\u7136\u7684\u5DE6\u53F3\u8111\u4E2D\u7F1D\uFF1A\u4E0D\u662F\u7B80\u5355\u76F4\u7F1D\uFF0C\u800C\u662F\u4E0A\u5BBD\u4E0B\u7A84\u3001\u7565\u5E26\u5F27\u5EA6\u7684\u7EB5\u88C2\r
      const fissureWidth =\r
        0.34 +\r
        0.23 * gauss(y, 8.8, 5.4) +\r
        0.07 * gauss(z, 0.0, 7.0);\r
\r
      const medialInfluence = Math.exp(-Math.pow(Math.abs(x) / 2.1, 2));\r
      x += side * medialInfluence * (0.78 + 0.18 * gauss(y, 8.0, 5.0));\r
\r
      const xN = THREE.MathUtils.clamp((x - centerX) / 10.5, -1, 1);\r
      const yN = THREE.MathUtils.clamp((y - 2.65) / 12.0, -1, 1);\r
      const zN = THREE.MathUtils.clamp(z / 10.2, -1, 1);\r
\r
      const polarFade = smoothstep(0.12, 0.34, sinT);\r
\r
      const crownMask = gauss(theta, 0.12 * Math.PI, 0.12 * Math.PI);\r
      const superiorMask = gauss(y, 12.4, 3.4);\r
      const medialMask = gauss(Math.abs(x), 3.0, 2.2);\r
\r
      const f = corticalField(theta, phi, side, xN, yN, zN);\r
\r
      let displacement = f * 0.64 * polarFade;\r
      displacement *= (1.0 - 0.43 * crownMask * superiorMask);\r
      displacement *= (1.0 - 0.14 * medialMask);\r
\r
      // -------------------------\r
      // \u771F\u5B9E\u611F\u4E3B\u6C9F / \u6B21\u7EA7\u6C9F\u7CFB\u7EDF\r
      // -------------------------\r
\r
      // \u4E2D\u592E\u6C9F\uFF1AS \u5F62\u3001\u5411\u4E0B\u5916\u4FA7\u5EF6\u4F38\r
      const centralCurve =\r
        2.0 +\r
        0.95 * Math.sin(x * 0.115) -\r
        0.085 * (y - 5.5) +\r
        0.16 * Math.sin(y * 0.28);\r
\r
      let centralDepth =\r
        groove(z - centralCurve, 0.56) *\r
        gauss(y, 6.2, 5.8) *\r
        (0.30 + 0.70 * Math.min(1, Math.abs(x) / 9.2));\r
      centralDepth *= polarFade;\r
      centralDepth *= (1.0 - 0.80 * crownMask * superiorMask);\r
      displacement -= centralDepth * 1.34;\r
\r
      // \u4E2D\u592E\u540E\u6C9F\uFF1A\u4E2D\u592E\u6C9F\u540E\u65B9\u8F83\u6D45\u7684\u6B21\u7EA7\u6C9F\r
      const postCentralCurve =\r
        -0.35 +\r
        0.72 * Math.sin(x * 0.10 + 0.35) -\r
        0.055 * (y - 5.0);\r
\r
      let postCentral =\r
        groove(z - postCentralCurve, 0.43) *\r
        gauss(y, 6.6, 4.7) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 2.3) / 6.5));\r
      postCentral *= polarFade;\r
      displacement -= postCentral * 0.62;\r
\r
      // \u9876\u5185\u6C9F\uFF1A\u9876\u53F6\u533A\u57DF\u6A2A\u5411\u957F\u6C9F\r
      const intraparietalCurve =\r
        -2.6 +\r
        0.55 * Math.sin(x * 0.13 - 0.2) +\r
        0.10 * (y - 7.0);\r
\r
      let intraparietal =\r
        groove(z - intraparietalCurve, 0.39) *\r
        gauss(y, 8.1, 3.5) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 3.0) / 5.5));\r
      intraparietal *= polarFade;\r
      displacement -= intraparietal * 0.56;\r
\r
      // \u5916\u4FA7\u88C2\uFF1A\u989E\u53F6\u4E0A\u7F18\uFF0C\u5F27\u5F62\u66F4\u660E\u663E\r
      const lateralTarget =\r
        0.85 +\r
        0.58 * Math.sin(z * 0.19) -\r
        0.035 * (Math.abs(x) - 7.0);\r
\r
      let lateralDepth =\r
        groove(y - lateralTarget, 0.48) *\r
        gauss(z, 2.0, 5.9) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 3.6) / 6.6));\r
      lateralDepth *= polarFade;\r
      lateralDepth *= (1.0 - 0.77 * crownMask);\r
      displacement -= lateralDepth * 1.36;\r
\r
      // \u4E0A\u989E\u6C9F\uFF1A\u4E0E\u5916\u4FA7\u88C2\u5E73\u884C\u4F46\u66F4\u6D45\r
      const supTemporalTarget =\r
        -0.95 +\r
        0.42 * Math.sin(z * 0.20 + 0.65);\r
\r
      let superiorTemporal =\r
        groove(y - supTemporalTarget, 0.36) *\r
        gauss(z, 1.2, 5.4) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 5.1) / 5.5));\r
      displacement -= superiorTemporal * 0.54;\r
\r
      // \u4E0B\u989E\u6C9F\uFF1A\u66F4\u9760\u4E0B\u3001\u66F4\u5F31\r
      const infTemporalTarget =\r
        -2.9 +\r
        0.34 * Math.sin(z * 0.18 - 0.5);\r
\r
      let inferiorTemporal =\r
        groove(y - infTemporalTarget, 0.32) *\r
        gauss(z, 0.8, 5.0) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 5.5) / 5.0));\r
      displacement -= inferiorTemporal * 0.38;\r
\r
      // \u9876\u6795\u6C9F\uFF1A\u540E\u4E0A\u90E8\u660E\u663E\u6C9F\u69FD\r
      let occDepth =\r
        groove(z + 5.75 - 0.34 * Math.sin(x * 0.16), 0.48) *\r
        gauss(y, 7.3, 4.0);\r
      occDepth *= polarFade;\r
      occDepth *= (1.0 - 0.33 * crownMask * superiorMask);\r
      displacement -= occDepth * 0.96;\r
\r
      // \u989D\u53F6\u6B21\u7EA7\u6C9F\uFF1A\u4E0A\u989D\u6C9F / \u4E0B\u989D\u6C9F\r
      const frontalSide = Math.min(1, Math.max(0, (Math.abs(x) - 4.0) / 5.5));\r
      let supFrontal =\r
        groove(y - (7.7 + 0.38 * Math.sin(z * 0.20)), 0.34) *\r
        gauss(z, 6.2, 4.3) *\r
        frontalSide;\r
      displacement -= supFrontal * 0.44;\r
\r
      let infFrontal =\r
        groove(y - (4.2 + 0.32 * Math.sin(z * 0.22 + 0.4)), 0.32) *\r
        gauss(z, 6.1, 4.2) *\r
        frontalSide;\r
      displacement -= infFrontal * 0.39;\r
\r
      // -------------------------\r
      // \u8111\u56DE\u51F8\u8D77\uFF1A\u6C9F\u4E0E\u6C9F\u4E4B\u95F4\u8F7B\u5FAE\u62AC\u9AD8\r
      // -------------------------\r
      const superiorFrontalRidge =\r
        ridge(y - 9.2, 0.65) * gauss(z, 6.1, 4.5) * frontalSide;\r
      displacement += superiorFrontalRidge * 0.25;\r
\r
      const precentralRidge =\r
        ridge(z - (3.25 + 0.80 * Math.sin(x * 0.11)), 0.74) *\r
        gauss(y, 6.0, 5.0) *\r
        Math.min(1, Math.max(0, (Math.abs(x) - 2.4) / 6.0));\r
      displacement += precentralRidge * 0.23;\r
\r
      const postcentralRidge =\r
        ridge(z - (0.75 + 0.68 * Math.sin(x * 0.10 + 0.15)), 0.70) *\r
        gauss(y, 6.3, 4.8);\r
      displacement += postcentralRidge * 0.19;\r
\r
      // -------------------------\r
      // \u7B2C\u4E09\u7EA7\u533A\u57DF\u5316\u8111\u6C9F\u7F51\u7EDC\r
      // \u8FD9\u4E9B\u6C9F\u69FD\u66F4\u7EC6\u3001\u66F4\u788E\uFF0C\u4E3B\u8981\u7528\u4E8E\u8BA9\u5927\u8111\u76AE\u5C42\u8FDC\u770B\u4E5F\u80FD\u770B\u5230\u660E\u663E\u6C9F\u56DE\u5C42\u6B21\u3002\r
      // -------------------------\r
      const frontalWeight = clamp01((zN + 0.05) / 0.95) * clamp01((Math.abs(xN) + 0.15) / 1.15);\r
      const parietalWeight = clamp01((yN + 0.10) / 0.90) * (1.0 - frontalWeight * 0.35);\r
      const temporalWeight = clamp01((-yN + 0.10) / 1.05) * clamp01((Math.abs(xN) - 0.10) / 0.90);\r
      const occipitalWeight = clamp01((-zN + 0.12) / 1.05);\r
\r
      const frontalFineA = groove(\r
        Math.sin((zN * 8.4 - yN * 2.1 + xN * 0.55) * Math.PI),\r
        0.34\r
      );\r
      const frontalFineB = groove(\r
        Math.sin((zN * 12.2 + xN * 1.8 - yN * 0.7) * Math.PI),\r
        0.28\r
      );\r
      displacement -= frontalWeight * (frontalFineA * 0.12 + frontalFineB * 0.08) * polarFade;\r
\r
      const parietalFineA = groove(\r
        Math.sin((xN * 7.8 + zN * 1.2 + yN * 0.35) * Math.PI),\r
        0.32\r
      );\r
      const parietalFineB = groove(\r
        Math.sin((xN * 11.6 - zN * 2.2) * Math.PI),\r
        0.27\r
      );\r
      displacement -= parietalWeight * (parietalFineA * 0.13 + parietalFineB * 0.075) * polarFade;\r
\r
      const temporalFineA = groove(\r
        Math.sin((yN * 7.0 + zN * 4.4 + xN * 0.55) * Math.PI),\r
        0.32\r
      );\r
      const temporalFineB = groove(\r
        Math.sin((zN * 9.8 - yN * 3.3) * Math.PI),\r
        0.27\r
      );\r
      displacement -= temporalWeight * (temporalFineA * 0.12 + temporalFineB * 0.075) * polarFade;\r
\r
      const occipitalFineA = groove(\r
        Math.sin((xN * 6.0 - zN * 8.8 + yN * 0.5) * Math.PI),\r
        0.31\r
      );\r
      const occipitalFineB = groove(\r
        Math.sin((xN * 9.2 - zN * 13.0) * Math.PI),\r
        0.25\r
      );\r
      displacement -= occipitalWeight * (occipitalFineA * 0.12 + occipitalFineB * 0.07) * polarFade;\r
\r
      // \u5BF9\u5E94\u8111\u56DE\u51F8\u8D77\uFF0C\u8BA9\u6C9F\u548C\u56DE\u7684\u9AD8\u5EA6\u5DEE\u66F4\u660E\u663E\r
      const corticalRidgeNetwork =\r
        0.055 * Math.max(0, Math.sin((xN * 5.2 + zN * 2.1 - yN * 0.6) * Math.PI)) +\r
        0.040 * Math.max(0, Math.sin((xN * 8.8 - zN * 3.2 + yN * 1.1) * Math.PI));\r
      displacement += corticalRidgeNetwork * polarFade;\r
\r
      // \u5FAE\u7EC6\u5C40\u90E8\u51F9\u9677\uFF0C\u53EA\u505A\u8868\u9762\u8D77\u4F0F\uFF0C\u4E0D\u5F62\u6210\u7A7F\u5B54\r
      const microIndent =\r
        0.095 * Math.max(0, Math.sin((xN * 11.0 + zN * 5.4 + yN * 2.1) * Math.PI)) +\r
        0.065 * Math.max(0, Math.sin((xN * 17.0 - zN * 8.2) * Math.PI));\r
      displacement -= microIndent * polarFade * (0.48 + 0.72 * Math.abs(xN));\r
\r
      // \u9876\u90E8\u4E25\u683C\u9650\u5236\u8FC7\u6DF1\u51F9\u9677\uFF0C\u907F\u514D\u51FA\u73B0\u201C\u5B54\u6D1E\u201D\r
      const crownSmooth = crownMask * superiorMask;\r
      if (crownSmooth > 0.10 && displacement < -0.16) {\r
        displacement = -0.16 + (displacement + 0.16) * 0.11;\r
      }\r
\r
      // \u5168\u5C40\u51F9\u9677\u9650\u5E45\uFF1A\u4FDD\u6301\u660E\u663E\u8111\u6C9F\uFF0C\u4F46\u4E0D\u5141\u8BB8\u5F62\u6210\u7A7F\u5B54\r
      displacement = Math.max(displacement, -1.42);\r
\r
      const nx = (x - centerX) / (rx * rx);\r
      const ny = (y - 2.65) / (ry * ry);\r
      const nz = z / (rz * rz);\r
      const nl = Math.hypot(nx, ny, nz) || 1;\r
\r
      x += nx / nl * displacement;\r
      y += ny / nl * displacement;\r
      z += nz / nl * displacement;\r
\r
      // \u4E0B\u7F18\u4FEE\u578B\uFF0C\u4FDD\u6301\u66F4\u50CF\u53C2\u8003\u56FE\u7684\u6B63\u9762\u8F6E\u5ED3\r
      if (y < -5.5 && Math.abs(x) > 8.0 && z > 1.0) continue;\r
      if (y < -7.6) continue;\r
      if (z > 12.0 && Math.abs(x) > 8.2) continue;\r
\r
      // \u7EB5\u88C2\u88C1\u5207\u66F4\u81EA\u7136\r
      if (Math.abs(x) < fissureWidth && y > -0.5) continue;\r
\r
      const region = cortexRegion(x, y, z);\r
      const depth = THREE.MathUtils.clamp((displacement + 1.48) / 3.05, 0, 1);\r
      byRegion[region].push({ x, y, z, depth });\r
    }\r
  }\r
\r
  Object.entries(byRegion).forEach(([region, points]) => {\r
    const mat = new THREE.MeshLambertMaterial({\r
      color: regionGray[region],\r
      transparent: true,\r
      opacity: 0.96\r
    });\r
\r
    const mesh = new THREE.InstancedMesh(geo, mat, points.length);\r
    const dummy = new THREE.Object3D();\r
    const base = new THREE.Color(regionGray[region]);\r
    const shadeColor = new THREE.Color();\r
\r
    for (let i = 0; i < points.length; i++) {\r
      const p = points[i];\r
      dummy.position.set(p.x, p.y, p.z);\r
      dummy.scale.set(1, 1, 1);\r
      dummy.updateMatrix();\r
      mesh.setMatrixAt(i, dummy.matrix);\r
\r
      const shade = 0.58 + p.depth * 0.46;\r
      mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(shade));\r
    }\r
\r
    mesh.instanceMatrix.needsUpdate = true;\r
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;\r
    mesh.userData.region = region;\r
    mesh.userData.kind = 'cortex';\r
    brainRoot.add(mesh);\r
    cortexMeshes.push(mesh);\r
    createCortexAnimationProxy(\r
      mesh,\r
      points,\r
      cubeSize * 1.15,\r
      p => 0.58 + p.depth * 0.46\r
    );\r
    window.__brainPerformance.cortexInstances += points.length;\r
  });\r
}\r
\r
buildCortexHemisphere(-1);\r
buildCortexHemisphere(1);\r
\r
// ---------------------------------------------------------------------\r
// \u5C0F\u8111\uFF1A\u66F4\u9AD8\u9891\u7684\u6A2A\u5411\u56DE\u7EB9\r
// ---------------------------------------------------------------------\r
function buildCerebellumLobe(side) {\r
  const thetaSteps = quality.cerebellumTheta;\r
  const phiSteps = quality.cerebellumPhi;\r
  const cubeSize = quality.cerebellumCube;\r
  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);\r
  const pts = [];\r
\r
  const cx = side * 4.0;\r
  const cy = -6.7;\r
  const cz = -6.9;\r
\r
  for (let ti = 3; ti < thetaSteps - 3; ti++) {\r
    const theta = Math.PI * ti / (thetaSteps - 1);\r
    for (let pi = 0; pi < phiSteps; pi++) {\r
      const phi = Math.PI * 2 * pi / phiSteps;\r
\r
      const sinT = Math.sin(theta);\r
      const cosT = Math.cos(theta);\r
\r
      let x = cx + 4.0 * sinT * Math.cos(phi);\r
      let y = cy + 2.65 * cosT;\r
      let z = cz + 3.1 * sinT * Math.sin(phi);\r
\r
      // \u66F4\u50CF\u5C0F\u8111\u53F6\u7247\uFF08folia\uFF09\u7684\u6A2A\u5411\u7EC6\u7EB9\r
      const stripe =\r
        Math.sin(theta * 22.0 + Math.sin(phi * 2.2)) * 0.22 +\r
        Math.sin(phi * 6.0) * 0.05;\r
\r
      const nx = (x - cx) / (4.0 * 4.0);\r
      const ny = (y - cy) / (2.65 * 2.65);\r
      const nz = (z - cz) / (3.1 * 3.1);\r
      const nl = Math.hypot(nx, ny, nz) || 1;\r
\r
      x += nx / nl * stripe;\r
      y += ny / nl * stripe;\r
      z += nz / nl * stripe;\r
\r
      pts.push({x,y,z,depth:(stripe+0.35)/0.7});\r
    }\r
  }\r
\r
  const mat = new THREE.MeshLambertMaterial({\r
    color: regionGray.cerebellum,\r
    transparent: true,\r
    opacity: 0.93\r
  });\r
\r
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r
  const dummy = new THREE.Object3D();\r
  const base = new THREE.Color(regionGray.cerebellum);\r
  const shadeColor = new THREE.Color();\r
\r
  pts.forEach((p, i) => {\r
    dummy.position.set(p.x, p.y, p.z);\r
    dummy.updateMatrix();\r
    mesh.setMatrixAt(i, dummy.matrix);\r
    mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(0.81 + p.depth * 0.16));\r
  });\r
\r
  mesh.instanceMatrix.needsUpdate = true;\r
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;\r
  mesh.userData.region = 'cerebellum';\r
  mesh.userData.kind = 'cortex';\r
  brainRoot.add(mesh);\r
  cortexMeshes.push(mesh);\r
  createCortexAnimationProxy(\r
    mesh,\r
    pts,\r
    cubeSize * 1.15,\r
    p => 0.81 + p.depth * 0.16\r
  );\r
  window.__brainPerformance.cortexInstances += pts.length;\r
}\r
\r
buildCerebellumLobe(-1);\r
buildCerebellumLobe(1);\r
\r
// ---------------------------------------------------------------------\r
// \u8111\u5E72\uFF1A\u53C2\u8003\u56FE\u4E2D\u660E\u663E\u7684\u5411\u4E0B\u5EF6\u4F38\u7ED3\u6784\r
// ---------------------------------------------------------------------\r
function buildBrainStem() {\r
  const pts = [];\r
  const stepY = 0.30;\r
  const ring = 16;\r
\r
  for (let y = -7.3; y >= -15.6; y -= stepY) {\r
    const t = (Math.abs(y + 7.3)) / 8.3;\r
    const radius = 0.95 - t * 0.42 + Math.sin(t * 7.0) * 0.04;\r
\r
    for (let i = 0; i < ring; i++) {\r
      const a = Math.PI * 2 * i / ring;\r
      pts.push({\r
        x: Math.cos(a) * radius * 0.72,\r
        y,\r
        z: -5.9 + Math.sin(a) * radius * 0.52\r
      });\r
    }\r
  }\r
\r
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);\r
  const mat = new THREE.MeshLambertMaterial({\r
    color: regionGray.brainstem,\r
    transparent: true,\r
    opacity: 0.92\r
  });\r
\r
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r
  const dummy = new THREE.Object3D();\r
\r
  pts.forEach((p,i) => {\r
    dummy.position.set(p.x,p.y,p.z);\r
    dummy.updateMatrix();\r
    mesh.setMatrixAt(i,dummy.matrix);\r
  });\r
\r
  mesh.instanceMatrix.needsUpdate = true;\r
  mesh.userData.region = 'brainstem';\r
  mesh.userData.kind = 'cortex';\r
  brainRoot.add(mesh);\r
  cortexMeshes.push(mesh);\r
  createCortexAnimationProxy(mesh, pts, 0.26, () => 0.92);\r
  window.__brainPerformance.cortexInstances += pts.length;\r
}\r
\r
buildBrainStem();\r
\r
// ---------------------------------------------------------------------\r
// \u534A\u900F\u660E\u5185\u90E8\uFF1A\u8F83\u7C97\u4F53\u7D20\uFF0C\u53EA\u8868\u8FBE\u6DF1\u5C42\u7ED3\u6784\u4E0E\u5C42\u6B21\uFF0C\u4E0D\u62A2\u76AE\u5C42\u89C6\u89C9\u3002\r
// ---------------------------------------------------------------------\r
function insideCore(x,y,z) {\r
  const left =\r
    Math.pow((x + 5.0)/8.8, 2) +\r
    Math.pow((y - 2.3)/9.2, 2) +\r
    Math.pow(z/8.6, 2) <= 1;\r
\r
  const right =\r
    Math.pow((x - 5.0)/8.8, 2) +\r
    Math.pow((y - 2.3)/9.2, 2) +\r
    Math.pow(z/8.6, 2) <= 1;\r
\r
  return left || right;\r
}\r
\r
function buildCore() {\r
  const step = 1.30;\r
  const positions = [];\r
\r
  for (let x=-13; x<=13; x+=step) {\r
    for (let y=-6; y<=11; y+=step) {\r
      for (let z=-10; z<=10; z+=step) {\r
        if (!insideCore(x,y,z)) continue;\r
        if (Math.abs(x) < 0.95 && y > -0.5) continue;\r
\r
        // \u53EA\u4FDD\u7559\u4E00\u90E8\u5206\u70B9\uFF0C\u8BA9\u5185\u90E8\u6709\u201C\u534A\u900F\u660E\u5C42\u201D\u800C\u4E0D\u662F\u5B9E\u5FC3\u5899\u3002\r
        const mask = Math.sin(x*0.83) + Math.cos(y*0.71) + Math.sin(z*0.77);\r
        if (mask > 1.65) continue;\r
\r
        positions.push([x,y,z]);\r
      }\r
    }\r
  }\r
\r
  const geo = new THREE.BoxGeometry(0.96,0.96,0.96);\r
  const mat = new THREE.MeshStandardMaterial({\r
    color: 0xcfcfcf,\r
    roughness: 1,\r
    transparent: true,\r
    opacity: 0.11,\r
    depthWrite: false\r
  });\r
\r
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);\r
  const dummy = new THREE.Object3D();\r
\r
  positions.forEach((p,i) => {\r
    dummy.position.set(p[0],p[1],p[2]);\r
    dummy.updateMatrix();\r
    mesh.setMatrixAt(i,dummy.matrix);\r
  });\r
\r
  mesh.instanceMatrix.needsUpdate = true;\r
  mesh.userData.kind = 'core';\r
  brainRoot.add(mesh);\r
  coreMeshes.push(mesh);\r
}\r
\r
buildCore();\r
\r
// \u6D77\u9A6C\u4F53\uFF1A\u5185\u90E8\u8F83\u6DF1\u7070\u7684\u534A\u900F\u660E\u53CC\u4FA7\u7ED3\u6784\r
function buildHippocampus(side) {\r
  const pts = [];\r
  const steps = 78;\r
  for (let i=0;i<steps;i++) {\r
    const t = i/(steps-1);\r
    const a = -1.15 + t*2.30;\r
    const x = side*(4.3 + Math.cos(a)*1.8);\r
    const y = -0.8 + Math.sin(a)*1.05;\r
    const z = -1.4 + Math.sin(a*1.35)*2.1;\r
\r
    for (let r=0;r<7;r++) {\r
      const aa = Math.PI*2*r/7;\r
      pts.push([\r
        x + Math.cos(aa)*0.42,\r
        y + Math.sin(aa)*0.30,\r
        z + Math.sin(aa)*0.42\r
      ]);\r
    }\r
  }\r
\r
  const geo = new THREE.BoxGeometry(0.28,0.28,0.28);\r
  const mat = new THREE.MeshStandardMaterial({\r
    color: regionGray.hippocampus,\r
    roughness: 1,\r
    transparent: true,\r
    opacity: 0.38,\r
    depthWrite: false\r
  });\r
\r
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r
  const dummy = new THREE.Object3D();\r
\r
  pts.forEach((p,i)=>{\r
    dummy.position.set(...p);\r
    dummy.updateMatrix();\r
    mesh.setMatrixAt(i,dummy.matrix);\r
  });\r
\r
  mesh.instanceMatrix.needsUpdate = true;\r
  mesh.userData.kind = 'core';\r
  mesh.userData.region = 'hippocampus';\r
  brainRoot.add(mesh);\r
  coreMeshes.push(mesh);\r
}\r
\r
buildHippocampus(-1);\r
buildHippocampus(1);\r
\r
// ---------------------------------------------------------------------\r
// V11 \u795E\u7ECF\u5143\u6FC0\u6D3B\u6A21\u62DF\r
// ---------------------------------------------------------------------\r
// \u8BF4\u660E\uFF1A\u8FD9\u91CC\u662F\u524D\u7AEF\u89C6\u89C9\u5C42\u9762\u7684\u201C\u795E\u7ECF\u6FC0\u6D3B\u4F20\u64AD\u201D\u539F\u578B\u3002\r
// \u5B83\u6A21\u62DF\u8282\u70B9\u3001\u8FDE\u63A5\u548C\u6FC0\u6D3B\u6CE2\u4F20\u64AD\uFF0C\u4E0D\u7B49\u540C\u4E8E\u771F\u5B9E\u8111\u795E\u7ECF\u7535\u751F\u7406\u6A21\u578B\u3002\r
\r
const neuralGroup = new THREE.Group();\r
brainRoot.add(neuralGroup);\r
\r
let neuralVisible = true;\r
let neuralMode = 'spontaneous';\r
let neuralRAF = 0;\r
let neuralStartTime = performance.now();\r
let spontaneousSeedIndex = 0;\r
let neuralInitialized = false;\r
let neuralLastFrame = 0;\r
\r
const neuronPositions = [];\r
const neuronRegions = [];\r
const neuronAdj = [];\r
const edgePairs = [];\r
const activationDistance = [];\r
const rankedActivation = [];\r
let activationValues = null;\r
let neuronGeometry = null;\r
let neuronMaterial = null;\r
let neuronPoints = null;\r
let edgeGeometry = null;\r
let edgeMaterial = null;\r
let neuralEdges = null;\r
let activeSpheres = null;\r
const MAX_ACTIVE_SPHERES = quality.activeSpheres;\r
const neuralDummy = new THREE.Object3D();\r
\r
// \u795E\u7ECF\u7F51\u7EDC\u53E0\u52A0\u5C42\u4F7F\u7528\u51B7\u84DD\u7070\u5230\u8FD1\u767D\u7684\u6FC0\u6D3B\u8272\uFF0C\u4E0D\u6539\u53D8\u5E95\u5C42\u65B9\u5757\u8111\u548C Canonical \u5BF9\u8C61\u989C\u8272\u3002\r
const NEURAL_NODE_REST = [0.52, 0.63, 0.72];\r
const NEURAL_NODE_ACTIVE = [0.88, 0.95, 1.00];\r
const NEURAL_EDGE_REST = [0.60, 0.70, 0.78];\r
const NEURAL_EDGE_ACTIVE = [0.84, 0.92, 0.98];\r
const NEURAL_PULSE_HEX = 0xd8ebf5;\r
\r
function seededRandomFactory(seed=20260823) {\r
  let s = seed >>> 0;\r
  return function() {\r
    s += 0x6D2B79F5;\r
    let t = s;\r
    t = Math.imul(t ^ (t >>> 15), t | 1);\r
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);\r
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\r
  };\r
}\r
\r
const neuralRand = seededRandomFactory(20260823);\r
\r
function neuralRegion(x, y, z) {\r
  const hL =\r
    Math.pow((x + 4.8)/2.6, 2) +\r
    Math.pow((y + 1.0)/1.6, 2) +\r
    Math.pow((z + 1.5)/3.1, 2) <= 1;\r
  const hR =\r
    Math.pow((x - 4.8)/2.6, 2) +\r
    Math.pow((y + 1.0)/1.6, 2) +\r
    Math.pow((z + 1.5)/3.1, 2) <= 1;\r
\r
  if (hL || hR) return 'hippocampus';\r
  if (z > 4.5 && y > -1.4) return 'prefrontal';\r
  if (y > 4.8 && z > -5.8) return 'parietal';\r
  if (z < -5.7 && y > -1.5) return 'occipital';\r
  if (y < 2.0 && Math.abs(x) > 3.6) return 'temporal';\r
  return 'deep';\r
}\r
\r
function buildNeuralNodes() {\r
  const desired = quality.neuralNodes;\r
  let attempts = 0;\r
\r
  while (neuronPositions.length < desired && attempts < desired * 40) {\r
    attempts++;\r
\r
    const x = (neuralRand() * 2 - 1) * 12.4;\r
    const y = -5.8 + neuralRand() * 16.8;\r
    const z = (neuralRand() * 2 - 1) * 9.8;\r
\r
    if (!insideCore(x, y, z)) continue;\r
    if (Math.abs(x) < 0.82 && y > -0.5) continue;\r
\r
    // \u8BA9\u8282\u70B9\u5728\u6DF1\u5C42\u66F4\u7A00\u758F\u3001\u9760\u8FD1\u76AE\u5C42\u5185\u4FA7\u66F4\u4E30\u5BCC\u3002\r
    const shellBias =\r
      Math.abs(x) / 12.4 +\r
      Math.abs(y - 2.0) / 10.5 +\r
      Math.abs(z) / 9.8;\r
\r
    if (shellBias < 0.48 && neuralRand() < 0.36) continue;\r
\r
    neuronPositions.push(new THREE.Vector3(x, y, z));\r
    neuronRegions.push(neuralRegion(x, y, z));\r
  }\r
\r
  for (let i = 0; i < neuronPositions.length; i++) neuronAdj.push([]);\r
}\r
\r
function connectNeuralNodes() {\r
  const n = neuronPositions.length;\r
  const cellSize = 4.2;\r
  const maxRadius2 = cellSize * cellSize;\r
  const nearestCount = 3;\r
  const seen = new Set();\r
  const buckets = new Map();\r
\r
  const bucketCoordinate = value => Math.floor(value / cellSize);\r
  const bucketKey = (x, y, z) => \`\${x}:\${y}:\${z}\`;\r
\r
  for (let i = 0; i < n; i++) {\r
    const p = neuronPositions[i];\r
    const key = bucketKey(\r
      bucketCoordinate(p.x),\r
      bucketCoordinate(p.y),\r
      bucketCoordinate(p.z)\r
    );\r
    if (!buckets.has(key)) buckets.set(key, []);\r
    buckets.get(key).push(i);\r
  }\r
\r
  for (let i = 0; i < n; i++) {\r
    const candidates = [];\r
    const p = neuronPositions[i];\r
    const cx = bucketCoordinate(p.x);\r
    const cy = bucketCoordinate(p.y);\r
    const cz = bucketCoordinate(p.z);\r
\r
    for (let dx = -1; dx <= 1; dx++) {\r
      for (let dy = -1; dy <= 1; dy++) {\r
        for (let dz = -1; dz <= 1; dz++) {\r
          const bucket = buckets.get(bucketKey(cx + dx, cy + dy, cz + dz));\r
          if (!bucket) continue;\r
\r
          for (const j of bucket) {\r
            if (i === j) continue;\r
            const d2 = p.distanceToSquared(neuronPositions[j]);\r
            if (d2 <= maxRadius2) candidates.push([d2, j]);\r
          }\r
        }\r
      }\r
    }\r
\r
    candidates.sort((a,b) => a[0] - b[0]);\r
\r
    for (let k = 0; k < Math.min(nearestCount, candidates.length); k++) {\r
      const j = candidates[k][1];\r
      const a = Math.min(i,j);\r
      const b = Math.max(i,j);\r
      const key = \`\${a}:\${b}\`;\r
      if (seen.has(key)) continue;\r
      seen.add(key);\r
\r
      edgePairs.push([a,b]);\r
      neuronAdj[a].push(b);\r
      neuronAdj[b].push(a);\r
    }\r
  }\r
}\r
\r
function initializeNeuralNetwork() {\r
  if (neuralInitialized) return;\r
\r
  buildNeuralNodes();\r
  connectNeuralNodes();\r
\r
  // \u795E\u7ECF\u7F51\u7EDC\u9ED8\u8BA4\u9690\u85CF\uFF0C\u9996\u6B21\u5F00\u542F\u65F6\u624D\u521B\u5EFA GPU \u8D44\u6E90\u3002\r
  neuronGeometry = new THREE.BufferGeometry();\r
  const neuronArray = new Float32Array(neuronPositions.length * 3);\r
  const neuronColors = new Float32Array(neuronPositions.length * 3);\r
\r
  for (let i = 0; i < neuronPositions.length; i++) {\r
    const p = neuronPositions[i];\r
    neuronArray[i*3] = p.x;\r
    neuronArray[i*3+1] = p.y;\r
    neuronArray[i*3+2] = p.z;\r
    neuronColors[i*3] = NEURAL_NODE_REST[0];\r
    neuronColors[i*3+1] = NEURAL_NODE_REST[1];\r
    neuronColors[i*3+2] = NEURAL_NODE_REST[2];\r
  }\r
\r
  neuronGeometry.setAttribute('position', new THREE.BufferAttribute(neuronArray, 3));\r
  neuronGeometry.setAttribute('color', new THREE.BufferAttribute(neuronColors, 3));\r
  neuronMaterial = new THREE.PointsMaterial({\r
    size: 0.105,\r
    vertexColors: true,\r
    transparent: true,\r
    opacity: 0.82,\r
    sizeAttenuation: true,\r
    depthTest: false\r
  });\r
  neuronPoints = new THREE.Points(neuronGeometry, neuronMaterial);\r
  neuronPoints.renderOrder = 20;\r
  neuralGroup.add(neuronPoints);\r
\r
  const edgePositionArray = new Float32Array(edgePairs.length * 6);\r
  const edgeColorArray = new Float32Array(edgePairs.length * 6);\r
\r
  for (let e = 0; e < edgePairs.length; e++) {\r
    const [a,b] = edgePairs[e];\r
    const pa = neuronPositions[a];\r
    const pb = neuronPositions[b];\r
    edgePositionArray[e*6] = pa.x;\r
    edgePositionArray[e*6+1] = pa.y;\r
    edgePositionArray[e*6+2] = pa.z;\r
    edgePositionArray[e*6+3] = pb.x;\r
    edgePositionArray[e*6+4] = pb.y;\r
    edgePositionArray[e*6+5] = pb.z;\r
    for (let c=0;c<6;c++) {\r
      edgeColorArray[e*6+c] = c % 3 === 0 ? NEURAL_EDGE_REST[0]\r
        : c % 3 === 1 ? NEURAL_EDGE_REST[1]\r
        : NEURAL_EDGE_REST[2];\r
    }\r
  }\r
\r
  edgeGeometry = new THREE.BufferGeometry();\r
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositionArray, 3));\r
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColorArray, 3));\r
  edgeMaterial = new THREE.LineBasicMaterial({\r
    vertexColors: true,\r
    transparent: true,\r
    opacity: 0.28,\r
    depthTest: false\r
  });\r
  neuralEdges = new THREE.LineSegments(edgeGeometry, edgeMaterial);\r
  neuralEdges.renderOrder = 18;\r
  neuralGroup.add(neuralEdges);\r
\r
  if (!softwareRenderer) {\r
    const activeSphereGeo = new THREE.SphereGeometry(0.115, 7, 7);\r
    const activeSphereMat = new THREE.MeshBasicMaterial({\r
      color: NEURAL_PULSE_HEX,\r
      transparent: true,\r
      opacity: 0.92,\r
      depthTest: false\r
    });\r
    activeSpheres = new THREE.InstancedMesh(\r
      activeSphereGeo,\r
      activeSphereMat,\r
      MAX_ACTIVE_SPHERES\r
    );\r
    activeSpheres.count = 0;\r
    activeSpheres.renderOrder = 25;\r
    neuralGroup.add(activeSpheres);\r
  }\r
\r
  activationValues = new Float32Array(neuronPositions.length);\r
  neuralInitialized = true;\r
  computeActivationDistance(neuralMode);\r
  Object.assign(window.__brainPerformance, {\r
    neuralInitialized: true,\r
    neuralNodes: neuronPositions.length,\r
    neuralEdges: edgePairs.length\r
  });\r
}\r
\r
function sourceNodesForMode(mode) {\r
  const source = [];\r
\r
  if (mode === 'prefrontal') {\r
    for (let i=0;i<neuronRegions.length;i++) {\r
      if (neuronRegions[i] === 'prefrontal') source.push(i);\r
    }\r
  } else if (mode === 'hippocampus') {\r
    for (let i=0;i<neuronRegions.length;i++) {\r
      if (neuronRegions[i] === 'hippocampus') source.push(i);\r
    }\r
  } else if (mode === 'global') {\r
    // \u4ECE\u8111\u5E72\u9644\u8FD1/\u4E2D\u4E0B\u90E8\u5411\u6574\u4E2A\u8111\u4F20\u64AD\r
    let best = [];\r
    for (let i=0;i<neuronPositions.length;i++) {\r
      const p = neuronPositions[i];\r
      const score = Math.abs(p.x) + Math.abs(p.y + 4.0) + Math.abs(p.z + 4.8);\r
      best.push([score,i]);\r
    }\r
    best.sort((a,b)=>a[0]-b[0]);\r
    return best.slice(0,6).map(x=>x[1]);\r
  } else {\r
    // \u81EA\u53D1\u6FC0\u6D3B\uFF1A\u6BCF\u8F6E\u4ECE\u4E0D\u540C\u5C40\u90E8\u533A\u57DF\u968F\u673A\u4EA7\u751F 2~4 \u4E2A\u6E90\r
    const count = 3;\r
    for (let k=0;k<count;k++) {\r
      const idx = Math.floor(neuralRand() * neuronPositions.length);\r
      source.push(idx);\r
    }\r
  }\r
\r
  if (!source.length) {\r
    source.push(Math.floor(neuronPositions.length * 0.5));\r
  }\r
\r
  // \u6570\u91CF\u592A\u591A\u65F6\u53EA\u62BD\u53D6\u4E00\u90E8\u5206\uFF0C\u5F62\u6210\u5C40\u90E8\u6FC0\u6D3B\u4E2D\u5FC3\u3002\r
  if (source.length > 18) {\r
    const sampled = [];\r
    const stride = Math.max(1, Math.floor(source.length / 18));\r
    for (let i=0;i<source.length && sampled.length<18;i+=stride) sampled.push(source[i]);\r
    return sampled;\r
  }\r
\r
  return source;\r
}\r
\r
function computeActivationDistance(mode) {\r
  if (!neuralInitialized || !neuronPositions.length) return;\r
\r
  activationDistance.length = neuronPositions.length;\r
  activationDistance.fill(Infinity);\r
\r
  const sources = sourceNodesForMode(mode);\r
  const queue = [];\r
\r
  for (const s of sources) {\r
    activationDistance[s] = 0;\r
    queue.push(s);\r
  }\r
\r
  let qIndex = 0;\r
  while (qIndex < queue.length) {\r
    const cur = queue[qIndex++];\r
    const nextD = activationDistance[cur] + 1;\r
\r
    for (const nb of neuronAdj[cur]) {\r
      if (nextD < activationDistance[nb]) {\r
        activationDistance[nb] = nextD;\r
        queue.push(nb);\r
      }\r
    }\r
  }\r
}\r
\r
function setNeuralMode(mode) {\r
  neuralMode = mode;\r
  spontaneousSeedIndex++;\r
  neuralStartTime = performance.now();\r
  if (neuralInitialized) computeActivationDistance(mode);\r
\r
  const labels = {\r
    spontaneous: '\u81EA\u53D1\u8109\u51B2',\r
    prefrontal: '\u524D\u989D\u53F6\u6FC0\u6D3B',\r
    hippocampus: '\u6D77\u9A6C\u4F53\u6FC0\u6D3B',\r
    global: '\u5168\u8111\u4F20\u64AD\u6CE2'\r
  };\r
\r
  document.getElementById('neuralStatus').textContent = \`\u795E\u7ECF\u6FC0\u6D3B\uFF1A\${labels[mode]}\`;\r
\r
  document.getElementById('spontaneousBtn').classList.toggle('active', mode === 'spontaneous');\r
  document.getElementById('frontalPulseBtn').classList.toggle('active', mode === 'prefrontal');\r
  document.getElementById('hippocampusPulseBtn').classList.toggle('active', mode === 'hippocampus');\r
  document.getElementById('globalPulseBtn').classList.toggle('active', mode === 'global');\r
\r
  if (neuralVisible) startNeuralAnimation();\r
}\r
\r
function refreshBrainOcclusion() {\r
  // \u8BB0\u5FC6\u56FE\u8C31\u5F00\u542F\u65F6\u4F18\u5148\u4FDD\u8BC1\u8BB0\u5FC6\u7ED3\u6784\u53EF\u8BFB\u3002\r
  // \u795E\u7ECF\u7F51\u7EDC\u59CB\u7EC8\u662F\u53E0\u52A0\u5C42\uFF1B\u53EA\u6709\u201C\u56FE\u8C31\u900F\u89C6\u201D\u63A7\u5236\u5E95\u5C42\u5927\u8111\u7684\u906E\u6321\u3002\r
  const memoryXray = memoryVisible && memoryXrayEnabled;\r
  const separatedXray = memoryXray && memoryGrouped;\r
\r
  cortexMeshes.forEach(mesh => {\r
    if (memoryXray) {\r
      mesh.material.opacity = separatedXray ? 0.10 : 0.34;\r
      mesh.material.depthWrite = false;\r
    } else {\r
      mesh.material.opacity = 0.96;\r
      mesh.material.depthWrite = true;\r
    }\r
    mesh.material.needsUpdate = true;\r
  });\r
\r
  const proxyOpacity = memoryXray\r
    ? (separatedXray ? 0.10 : 0.34)\r
    : 0.92;\r
  cortexAnimationPairs.forEach(({proxy}) => {\r
    proxy.material.opacity = proxyOpacity;\r
  });\r
\r
  coreMeshes.forEach(mesh => {\r
    if (!coreVisible) return;\r
\r
    if (memoryXray) {\r
      // \u6D77\u9A6C\u4F53\u7A0D\u5FAE\u4FDD\u7559\uFF0C\u5176\u4F59\u5927\u65B9\u5757\u51E0\u4E4E\u9690\u85CF\uFF0C\u907F\u514D\u6321\u4F4F\u4E2D\u95F4\u8BB0\u5FC6\u8282\u70B9\u3002\r
      mesh.material.opacity =\r
        mesh.userData.region === 'hippocampus' ? 0.055 : 0.008;\r
    } else {\r
      mesh.material.opacity =\r
        mesh.userData.region === 'hippocampus' ? 0.38 : 0.11;\r
    }\r
\r
    mesh.material.depthWrite = false;\r
    mesh.material.needsUpdate = true;\r
  });\r
}\r
\r
function applyNeuralXray(active) {\r
  // \u4FDD\u7559\u65E7\u8C03\u7528\u70B9\uFF1B\u795E\u7ECF\u5F00\u5173\u672C\u8EAB\u4E0D\u518D\u6539\u53D8\u5E95\u5C42\u5927\u8111\u7684\u900F\u660E\u5EA6\u3002\r
  refreshBrainOcclusion();\r
}\r
\r
function updateNeuralFrame(now) {\r
  if (!neuralInitialized) return;\r
\r
  const elapsed = (now - neuralStartTime) / 1000;\r
  const cycle = neuralMode === 'global' ? 4.8 : 3.8;\r
  const localT = elapsed % cycle;\r
\r
  // \u81EA\u53D1\u6A21\u5F0F\u6BCF\u8F6E\u91CD\u65B0\u968F\u673A\u9009\u62E9\u6FC0\u6D3B\u6E90\u3002\r
  if (neuralMode === 'spontaneous') {\r
    const cycleIndex = Math.floor(elapsed / cycle);\r
    if (cycleIndex !== spontaneousSeedIndex) {\r
      spontaneousSeedIndex = cycleIndex;\r
      computeActivationDistance('spontaneous');\r
    }\r
  }\r
\r
  const nodeColorAttr = neuronGeometry.getAttribute('color');\r
  const edgeColorAttr = edgeGeometry.getAttribute('color');\r
\r
  const activation = activationValues;\r
  const speed = neuralMode === 'global' ? 0.115 : 0.090;\r
  const width = neuralMode === 'global' ? 0.38 : 0.30;\r
\r
  for (let i=0;i<activation.length;i++) {\r
    const hop = activationDistance[i];\r
\r
    if (!Number.isFinite(hop)) {\r
      activation[i] = 0;\r
      continue;\r
    }\r
\r
    const delay = hop * speed;\r
    const d = (localT - delay) / width;\r
\r
    let a = Math.exp(-d*d);\r
\r
    // \u7559\u5C11\u91CF\u5C3E\u8FF9\uFF0C\u89C6\u89C9\u4E0A\u50CF\u795E\u7ECF\u5174\u594B\u540E\u7684\u6B8B\u4F59\u6D3B\u52A8\r
    const tailD = (localT - delay - 0.44) / 0.72;\r
    a = Math.max(a, Math.exp(-tailD*tailD) * 0.22);\r
\r
    activation[i] = Math.min(1, a);\r
  }\r
\r
  // \u8282\u70B9\u989C\u8272\uFF1A\u9759\u606F\u84DD\u7070\uFF0C\u6FC0\u6D3B\u5411\u51B7\u767D\u8FC7\u6E21\u3002\r
  for (let i=0;i<activation.length;i++) {\r
    const a = activation[i];\r
    nodeColorAttr.array[i*3] = NEURAL_NODE_REST[0] + a * (NEURAL_NODE_ACTIVE[0] - NEURAL_NODE_REST[0]);\r
    nodeColorAttr.array[i*3+1] = NEURAL_NODE_REST[1] + a * (NEURAL_NODE_ACTIVE[1] - NEURAL_NODE_REST[1]);\r
    nodeColorAttr.array[i*3+2] = NEURAL_NODE_REST[2] + a * (NEURAL_NODE_ACTIVE[2] - NEURAL_NODE_REST[2]);\r
  }\r
  nodeColorAttr.needsUpdate = true;\r
\r
  // \u8FDE\u63A5\u7EBF\u968F\u4E24\u7AEF\u795E\u7ECF\u5143\u6D3B\u52A8\u5411\u51B7\u767D\u63D0\u4EAE\u3002\r
  for (let e=0;e<edgePairs.length;e++) {\r
    const [a,b] = edgePairs[e];\r
    const act = Math.max(activation[a], activation[b]) * 0.92 +\r
                Math.min(activation[a], activation[b]) * 0.08;\r
    const r = NEURAL_EDGE_REST[0] + act * (NEURAL_EDGE_ACTIVE[0] - NEURAL_EDGE_REST[0]);\r
    const g = NEURAL_EDGE_REST[1] + act * (NEURAL_EDGE_ACTIVE[1] - NEURAL_EDGE_REST[1]);\r
    const blue = NEURAL_EDGE_REST[2] + act * (NEURAL_EDGE_ACTIVE[2] - NEURAL_EDGE_REST[2]);\r
\r
    edgeColorAttr.array[e*6] = r;\r
    edgeColorAttr.array[e*6+1] = g;\r
    edgeColorAttr.array[e*6+2] = blue;\r
    edgeColorAttr.array[e*6+3] = r;\r
    edgeColorAttr.array[e*6+4] = g;\r
    edgeColorAttr.array[e*6+5] = blue;\r
  }\r
  edgeColorAttr.needsUpdate = true;\r
\r
  if (activeSpheres) {\r
    // \u539F\u751F GPU \u4E0A\u7528\u5C0F\u7403\u5F3A\u5316\u6700\u5F3A\u8282\u70B9\uFF1B\u8F6F\u4EF6\u6E32\u67D3\u5668\u4FDD\u7559\u8F7B\u91CF\u70B9\u8272\u4F20\u64AD\u3002\r
    rankedActivation.length = 0;\r
    for (let i=0;i<activation.length;i++) {\r
      if (activation[i] > 0.48) rankedActivation.push([activation[i],i]);\r
    }\r
    rankedActivation.sort((a,b)=>b[0]-a[0]);\r
\r
    const count = Math.min(MAX_ACTIVE_SPHERES, rankedActivation.length);\r
    activeSpheres.count = count;\r
\r
    for (let k=0;k<count;k++) {\r
      const [a,i] = rankedActivation[k];\r
      const p = neuronPositions[i];\r
      const s = 0.72 + a * 1.65;\r
\r
      neuralDummy.position.copy(p);\r
      neuralDummy.scale.setScalar(s);\r
      neuralDummy.updateMatrix();\r
      activeSpheres.setMatrixAt(k, neuralDummy.matrix);\r
    }\r
    activeSpheres.instanceMatrix.needsUpdate = true;\r
  }\r
}\r
\r
function neuralAnimationLoop(now) {\r
  if (!neuralVisible) {\r
    neuralRAF = 0;\r
    return;\r
  }\r
\r
  neuralRAF = requestAnimationFrame(neuralAnimationLoop);\r
  if (document.hidden || now - neuralLastFrame < animationFrameInterval) return;\r
  neuralLastFrame = now;\r
  updateNeuralFrame(now);\r
  render();\r
}\r
\r
function startNeuralAnimation() {\r
  if (!neuralVisible) return;\r
  if (neuralRAF) return;\r
  neuralLastFrame = 0;\r
  neuralRAF = requestAnimationFrame(neuralAnimationLoop);\r
}\r
\r
function stopNeuralAnimation() {\r
  if (neuralRAF) {\r
    cancelAnimationFrame(neuralRAF);\r
    neuralRAF = 0;\r
  }\r
}\r
\r
function updateNeuralVisible(show) {\r
  neuralVisible = show;\r
  neuralGroup.visible = show;\r
\r
  const btn = document.getElementById('toggleNeuralBtn');\r
  btn.textContent = show ? '\u795E\u7ECF\u7F51\u7EDC\u5F00' : '\u795E\u7ECF\u7F51\u7EDC\u5173';\r
  btn.classList.toggle('active', show);\r
\r
  applyNeuralXray(show);\r
\r
  if (show) {\r
    initializeNeuralNetwork();\r
    setLightweightAnimation('neural', true);\r
    neuralStartTime = performance.now();\r
    computeActivationDistance(neuralMode);\r
    startNeuralAnimation();\r
  } else {\r
    stopNeuralAnimation();\r
    setLightweightAnimation('neural', false);\r
    render();\r
  }\r
}\r
\r
// ---------------------------------------------------------------------\r
// Canonical L3 \u6FC0\u6D3B\u77E5\u8BC6\u56FE\r
// ---------------------------------------------------------------------\r
// \u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u4E8B\u5B9E\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u6A21\u5F0F\u3001\u89C4\u5219\u548C\u6D3E\u751F\u4E8B\u5B9E\u5171\u4EAB\u4E00\u4E2A\u6743\u5A01\u56FE\u3002\r
// \u5BF9\u8C61\u7C7B\u578B\u53EA\u51B3\u5B9A\u51E0\u4F55\u7F16\u7801\uFF0C\u4E0D\u6784\u6210\u72EC\u7ACB\u77E5\u8BC6\u5C42\uFF1B\u5F53\u524D\u753B\u9762\u662F\u53EF\u91CD\u5EFA\u7684\u6FC0\u6D3B\u5B50\u56FE\u3002\r
// Document / Section / Chunk / DocumentVector \u4F4D\u4E8E\u56FE\u5916\u8BC1\u636E\u901A\u9053\uFF0C\u901A\u8FC7 EvidenceLink \u56DE\u6E90\u3002\r
\r
const memoryRoot = new THREE.Group();\r
brainRoot.add(memoryRoot);\r
\r
const memoryKindEvent = new THREE.Group();\r
const memoryKindFact = new THREE.Group();\r
const memoryKindSchema = new THREE.Group();\r
const memoryLinkEventFact = new THREE.Group();\r
const memoryLinkFactSchema = new THREE.Group();\r
const memoryShellGroup = new THREE.Group();\r
\r
memoryRoot.add(memoryShellGroup);\r
memoryRoot.add(memoryLinkEventFact);\r
memoryRoot.add(memoryLinkFactSchema);\r
memoryRoot.add(memoryKindEvent);\r
memoryRoot.add(memoryKindFact);\r
memoryRoot.add(memoryKindSchema);\r
\r
let memoryVisible = true;\r
let memoryXrayEnabled = true;\r
let memoryGrouped = false;\r
let eventKindVisible = true;\r
let factKindVisible = true;\r
let schemaKindVisible = true;\r
let selectedMemoryMesh = null;\r
let selectedMemoryData = null;\r
let memoryRAF = 0;\r
let memoryPulseMode = null;\r
let memoryPulseStart = 0;\r
let memoryLastFrame = 0;\r
let canonicalSnapshot = null;\r
let canonicalSnapshotSource = 'demo';\r
let canonicalSnapshotCursor = null;\r
let canonicalSnapshotLoading = false;\r
\r
const memoryClickable = [];\r
const memoryNodeById = new Map();\r
const memoryLinkMeshes = [];\r
const memoryIndexLinks = [];\r
const memoryLayoutScratch = new THREE.Vector3();\r
\r
// -----------------------------\r
// \u6F14\u793A\u6570\u636E\r
// -----------------------------\r
let canonicalEvents = [\r
  {\r
    id:'EVT-001', kind:'event', title:'\u7EDF\u4E00\u4E3A Canonical L3',\r
    summary:'\u5220\u9664\u72EC\u7ACB\u77E5\u8BC6\u5C42\u7EA7\uFF0C\u628A\u53EF\u63A8\u7406\u5BF9\u8C61\u5E76\u5165\u552F\u4E00\u6743\u5A01\u56FE\u3002',\r
    content:'\u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u6A21\u5F0F\u3001\u89C4\u5219\u548C\u6D3E\u751F\u4E8B\u5B9E\u7EDF\u4E00\u8FDB\u5165 Canonical L3\uFF1B\u5BF9\u8C61\u7C7B\u578B\u4FDD\u7559\uFF0C\u4F46\u4E0D\u518D\u62E5\u6709\u5F7C\u6B64\u5272\u88C2\u7684\u5B58\u50A8\u5C42\u7EA7\u3002',\r
    source:'\u67B6\u6784\u51B3\u7B56\u8BB0\u5F55', time:'2026-08-25',\r
    related:['ENT-CANONICAL-L3','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']\r
  },\r
  {\r
    id:'EVT-002', kind:'event', title:'\u786E\u8BA4\u72EC\u7ACB\u8BC1\u636E\u901A\u9053',\r
    summary:'DocumentVector \u4E0E BM25 \u7EE7\u7EED\u4FDD\u5B58\u4E8B\u5B9E\u8BC1\u636E\u548C\u6587\u672C\u5B9A\u4F4D\u80FD\u529B\u3002',\r
    content:'Document\u3001Section\u3001Chunk\u3001DocumentVector \u548C BM25 \u4E0D\u5E76\u5165\u56FE\u8282\u70B9\u5C42\u7EA7\uFF1B\u5B83\u4EEC\u901A\u8FC7 EvidenceLink \u4E3A\u56FE\u4E2D\u65AD\u8A00\u548C\u8BC1\u660E\u63D0\u4F9B\u53EF\u6838\u9A8C\u539F\u6587\u3002',\r
    source:'\u9879\u76EE\u6587\u6863\u4E0E\u4EE3\u7801\u6838\u5BF9', time:'2026-08-25',\r
    related:['ENT-DOCUMENT-VECTOR','FACT-EVIDENCE-SEPARATE','RULE-EVIDENCE-GROUNDED']\r
  },\r
  {\r
    id:'EVT-003', kind:'event', title:'\u8BC4\u4F30\u5343\u4E07\u7EA7\u56FE\u89C4\u6A21',\r
    summary:'\u5B8C\u6574\u56FE\u4E0D\u80FD\u5728\u5355\u6B21\u67E5\u8BE2\u6216\u6D4F\u89C8\u5668\u753B\u9762\u4E2D\u6574\u4F53\u52A0\u8F7D\u3002',\r
    content:'\u5F53\u8282\u70B9\u8FBE\u5230\u5343\u4E07\u7EA7\u65F6\uFF0C\u67E5\u8BE2\u5148\u901A\u8FC7\u7ED3\u6784\u8FC7\u6EE4\u3001\u5411\u91CF\u5019\u9009\u548C\u91CD\u6392\u5E8F\u5F62\u6210\u6709\u9650\u6FC0\u6D3B\u5B50\u56FE\uFF0C\u518D\u5728\u903B\u8F91\u5B8C\u6574\u56FE\u8303\u56F4\u5185\u6269\u5C55\u5FC5\u8981\u8BC1\u660E\u8DEF\u5F84\u3002',\r
    source:'\u89C4\u6A21\u98CE\u9669\u8BA8\u8BBA', time:'2026-08-25',\r
    related:['FACT-LOGICAL-SCOPE','FACT-ACTIVATED-BOUNDED','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'EVT-004', kind:'event', title:'\u5EFA\u7ACB\u8FC1\u79FB\u6062\u590D\u70B9',\r
    summary:'\u5728 schema \u8FC1\u79FB\u524D\u521B\u5EFA Git \u6807\u7B7E\u548C\u9879\u76EE\u5916\u5B8C\u6574\u5907\u4EFD\u3002',\r
    content:'\u8FC1\u79FB\u5FC5\u987B\u4FDD\u7559\u7A33\u5B9A\u8282\u70B9 ID\u3001\u5173\u7CFB ID\u3001EvidenceLink subject ID \u4E0E chunk ID\uFF0C\u5E76\u5148\u5728\u72B6\u6001\u526F\u672C\u4E0A\u9A8C\u8BC1\u5B8C\u6574\u6027\u3002',\r
    source:'\u8FC1\u79FB\u6267\u884C\u8BB0\u5F55', time:'2026-08-24',\r
    related:['FACT-STABLE-MIGRATION','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r
  },\r
  {\r
    id:'EVT-005', kind:'event', title:'\u5B9A\u4E49\u5B8C\u6574\u56FE\u63A8\u7406\u8FB9\u754C',\r
    summary:'\u5B8C\u6574\u56FE\u662F\u903B\u8F91\u53EF\u8FBE\u8303\u56F4\uFF0C\u4E0D\u662F\u6BCF\u6B21\u67E5\u8BE2\u7684\u7269\u7406\u52A0\u8F7D\u8303\u56F4\u3002',\r
    content:'\u63A8\u7406\u5668\u53EF\u4EE5\u6309\u89C4\u5219\u548C\u5173\u7CFB\u7EE7\u7EED\u6269\u5C55\u5C1A\u672A\u52A0\u8F7D\u7684\u8282\u70B9\uFF0C\u76F4\u5230\u547D\u4E2D\u76EE\u6807\u3001\u9884\u7B97\u6216\u505C\u6B62\u6761\u4EF6\uFF1B\u8FD4\u56DE\u7ED3\u679C\u540C\u65F6\u643A\u5E26\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\u3002',\r
    source:'\u63A8\u7406\u67B6\u6784\u8BA8\u8BBA', time:'2026-08-25',\r
    related:['FACT-LOGICAL-SCOPE','ENT-CANONICAL-RULE','RULE-INFERENCE-PROOF']\r
  },\r
  {\r
    id:'EVT-006', kind:'event', title:'\u5F15\u5165\u6FC0\u6D3B\u5B50\u56FE',\r
    summary:'\u8FD0\u884C\u65F6\u53EA\u4FDD\u7559\u5F53\u524D\u95EE\u9898\u76F8\u5173\u7684\u5019\u9009\u8282\u70B9\u3001\u5173\u7CFB\u548C\u8BC1\u660E\u8DEF\u5F84\u3002',\r
    content:'Activated Subgraph\u3001ANN\u3001Reranker \u4E0E Cache \u90FD\u662F\u53EF\u91CD\u5EFA\u8FD0\u884C\u65F6\u6D3E\u751F\u80FD\u529B\uFF0C\u4E0D\u662F\u65B0\u7684\u77E5\u8BC6\u5C42\uFF0C\u4E5F\u4E0D\u62E5\u6709\u6743\u5A01\u4E8B\u5B9E\u3002',\r
    source:'\u67E5\u8BE2\u6267\u884C\u8BBE\u8BA1', time:'2026-08-25',\r
    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'EVT-007', kind:'event', title:'\u5411\u91CF\u5316\u56FE\u5BF9\u8C61',\r
    summary:'\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u548C\u89C4\u5219\u53EF\u751F\u6210\u5411\u91CF\uFF0C\u7528\u4E8E\u53EC\u56DE\u4E0E\u91CD\u6392\u5E8F\u3002',\r
    content:'\u5411\u91CF\u7D22\u5F15\u4FDD\u5B58 Canonical ID \u4E0E\u7248\u672C\u6307\u9488\uFF1B\u5411\u91CF\u662F\u68C0\u7D22\u6295\u5F71\uFF0C\u4E0D\u66FF\u4EE3\u56FE\u4E2D\u7684\u5173\u7CFB\u7EA6\u675F\u3001\u89C4\u5219\u8BED\u4E49\u6216\u8BC1\u636E\u94FE\u3002',\r
    source:'\u68C0\u7D22\u67B6\u6784\u8BA8\u8BBA', time:'2026-08-25',\r
    related:['ENT-GRAPH-VECTOR-INDEX','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'EVT-008', kind:'event', title:'\u4FDD\u7559\u4E8B\u5B9E\u8BC1\u636E\u56DE\u6E90',\r
    summary:'\u4EFB\u4F55\u56DE\u7B54\u548C\u6D3E\u751F\u4E8B\u5B9E\u90FD\u5E94\u80FD\u5B9A\u4F4D\u5230\u652F\u6301\u5B83\u7684\u6587\u6863\u7247\u6BB5\u3002',\r
    content:'\u56FE\u5173\u7CFB\u8D1F\u8D23\u8868\u8FBE\u77E5\u8BC6\u7ED3\u6784\uFF0CEvidenceLink \u8D1F\u8D23\u8FDE\u63A5\u5177\u4F53 Chunk\uFF1B\u89C4\u5219\u8BC1\u660E\u4E0D\u80FD\u628A\u5411\u91CF\u76F8\u4F3C\u5EA6\u4F2A\u88C5\u6210\u4E8B\u5B9E\u8BC1\u636E\u3002',\r
    source:'\u8BC1\u636E\u6A21\u578B\u8BA8\u8BBA', time:'2026-08-25',\r
    related:['FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']\r
  },\r
  {\r
    id:'EVT-009', kind:'event', title:'\u89C4\u5219\u5E76\u5165\u6743\u5A01\u56FE',\r
    summary:'\u89C4\u5219\u3001\u6A21\u5F0F\u548C\u6D3E\u751F\u4E8B\u5B9E\u4E0E\u5B9E\u4F53\u5173\u7CFB\u5171\u4EAB\u7248\u672C\u5316\u6CBB\u7406\u3002',\r
    content:'\u89C4\u5219\u8282\u70B9\u63CF\u8FF0\u5339\u914D\u524D\u63D0\u4E0E\u7ED3\u8BBA\uFF0C\u6D3E\u751F\u4E8B\u5B9E\u8BB0\u5F55\u89C4\u5219\u7248\u672C\u3001\u8F93\u5165\u4E8B\u5B9E\u3001\u8BC1\u636E\u6765\u6E90\u548C\u751F\u6210\u65F6\u95F4\uFF0C\u652F\u6301\u5BA1\u8BA1\u4E0E\u5931\u6548\u91CD\u7B97\u3002',\r
    source:'Canonical L3 \u6A21\u578B\u8BBE\u8BA1', time:'2026-08-25',\r
    related:['ENT-CANONICAL-RULE','FACT-SINGLE-AUTHORITY','RULE-INFERENCE-PROOF']\r
  },\r
  {\r
    id:'EVT-010', kind:'event', title:'\u4E09\u7EF4\u89C6\u56FE\u6539\u4E3A\u9ED8\u8BA4\u878D\u5408',\r
    summary:'\u4E0D\u540C\u5BF9\u8C61\u5728\u540C\u4E00\u56FE\u7A7A\u95F4\u6DF7\u5408\u5206\u5E03\uFF0C\u7070\u9636\u548C\u5F62\u72B6\u53EA\u7F16\u7801\u7C7B\u578B\u3002',\r
    content:'\u9ED8\u8BA4\u753B\u9762\u5C55\u793A\u4E00\u4E2A Canonical L3 \u6FC0\u6D3B\u5B50\u56FE\u8FB9\u754C\uFF1B\u5BF9\u8C61\u5206\u7EC4\u53EA\u662F\u4E34\u65F6\u89C2\u5BDF\u6A21\u5F0F\uFF0C\u4E0D\u80FD\u88AB\u7406\u89E3\u4E3A\u72EC\u7ACB\u77E5\u8BC6\u5C42\u3002',\r
    source:'\u524D\u7AEF\u53EF\u89C6\u5316\u51B3\u7B56', time:'2026-08-25',\r
    related:['FACT-VISUAL-FUSION','ENT-CANONICAL-L3','RULE-VISUAL-ENCODING']\r
  },\r
  {\r
    id:'EVT-011', kind:'event', title:'\u9650\u5B9A\u9ED1\u767D\u7070\u89C6\u89C9\u8BED\u8A00',\r
    summary:'\u6240\u6709\u8282\u70B9\u3001\u5173\u7CFB\u3001\u72B6\u6001\u548C\u6FC0\u6D3B\u5F3A\u5EA6\u53EA\u4F7F\u7528\u7070\u9636\u3002',\r
    content:'\u77F3\u58A8\u9ED1\u5FAE\u70B9\u8868\u793A\u4E8B\u4EF6\uFF0C\u4E2D\u7070\u7EBF\u6846\u8868\u793A\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\uFF0C\u6D45\u7070\u591A\u9762\u4F53\u8868\u793A\u6A21\u5F0F\u4E0E\u89C4\u5219\uFF1B\u6FC0\u6D3B\u901A\u8FC7\u660E\u6697\u3001\u5C3A\u5BF8\u548C\u7EBF\u5BBD\u8868\u8FBE\u3002',\r
    source:'\u754C\u9762\u7EA6\u675F', time:'2026-08-25',\r
    related:['FACT-VISUAL-FUSION','RULE-VISUAL-ENCODING']\r
  },\r
  {\r
    id:'EVT-012', kind:'event', title:'\u9650\u5236\u6D4F\u89C8\u5668\u6E32\u67D3\u9884\u7B97',\r
    summary:'3D \u9875\u9762\u53EA\u6E32\u67D3\u53EF\u4EA4\u4E92\u7684\u6709\u9650\u8282\u70B9\u96C6\u5408\u3002',\r
    content:'\u540E\u7AEF\u5206\u9875\u5FEB\u7167\u3001LOD\u3001\u6279\u91CF\u51E0\u4F55\u548C\u6309\u9700\u5173\u7CFB\u5C55\u5F00\u5171\u540C\u63A7\u5236\u6E32\u67D3\u6210\u672C\uFF1B\u5B8C\u6574\u56FE\u89C4\u6A21\u4E0D\u76F4\u63A5\u51B3\u5B9A\u5F53\u524D\u5E27\u8282\u70B9\u6570\u3002',\r
    source:'\u524D\u7AEF\u6027\u80FD\u4F18\u5316', time:'2026-08-25',\r
    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r
  }\r
];\r
\r
let canonicalFacts = [\r
  {\r
    id:'ENT-CANONICAL-L3', kind:'entity', title:'Canonical L3',\r
    summary:'\u552F\u4E00\u6743\u5A01\u3001\u7248\u672C\u5316\u3001\u53EF\u5BA1\u8BA1\u7684\u5B8C\u6574\u77E5\u8BC6\u56FE\u3002',\r
    content:'\u627F\u8F7D TBox\u3001ABox\u3001\u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u89C4\u5219\u548C\u6D3E\u751F\u4E8B\u5B9E\uFF1B\u6240\u6709\u5BF9\u8C61\u4F7F\u7528\u7A33\u5B9A ID\uFF0C\u5E76\u63A5\u53D7\u7EDF\u4E00\u5B8C\u6574\u6027\u7EA6\u675F\u3002',\r
    source:'Canonical \u6570\u636E\u6A21\u578B', time:'schema 5',\r
    related:['EVT-001','EVT-004','EVT-010','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']\r
  },\r
  {\r
    id:'ENT-DOCUMENT-VECTOR', kind:'entity', title:'DocumentVector / BM25',\r
    summary:'\u9762\u5411\u539F\u6587\u7247\u6BB5\u7684\u5411\u91CF\u548C\u8BCD\u6CD5\u8BC1\u636E\u7D22\u5F15\u3002',\r
    content:'\u4FDD\u5B58\u6587\u6863\u7EA7\u4E0E Chunk \u7EA7\u68C0\u7D22\u6295\u5F71\uFF0C\u547D\u4E2D\u540E\u8FD4\u56DE\u539F\u6587\u5B9A\u4F4D\uFF1B\u5B83\u4E0D\u627F\u62C5\u6743\u5A01\u56FE\u5173\u7CFB\u6216\u5B8C\u6574\u56FE\u63A8\u7406\u3002',\r
    source:'\u72EC\u7ACB\u8BC1\u636E\u901A\u9053', time:'\u6301\u7EED\u66F4\u65B0',\r
    related:['EVT-002','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']\r
  },\r
  {\r
    id:'ENT-GRAPH-VECTOR-INDEX', kind:'entity', title:'\u56FE\u5BF9\u8C61\u5411\u91CF\u7D22\u5F15',\r
    summary:'Canonical \u8282\u70B9\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u548C\u89C4\u5219\u7684\u53EF\u91CD\u5EFA\u68C0\u7D22\u6295\u5F71\u3002',\r
    content:'\u7D22\u5F15\u9879\u6307\u5411 Canonical ID \u548C ontology_version\uFF1BANN \u53EA\u8D1F\u8D23\u5019\u9009\u53EC\u56DE\uFF0C\u6700\u7EC8\u7ED3\u679C\u8FD8\u8981\u7ECF\u8FC7\u7ED3\u6784\u7EA6\u675F\u3001\u91CD\u6392\u5E8F\u548C\u8BC1\u660E\u6821\u9A8C\u3002',\r
    source:'\u8FD0\u884C\u65F6\u6D3E\u751F\u7D22\u5F15', time:'\u53EF\u91CD\u5EFA',\r
    related:['EVT-007','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'ENT-CANONICAL-RULE', kind:'entity', title:'Canonical Rule',\r
    summary:'\u5305\u542B\u524D\u63D0\u3001\u7EA6\u675F\u3001\u7ED3\u8BBA\u548C\u7248\u672C\u4FE1\u606F\u7684\u56FE\u5185\u89C4\u5219\u5BF9\u8C61\u3002',\r
    content:'\u89C4\u5219\u5339\u914D\u4EA7\u751F\u6D3E\u751F\u4E8B\u5B9E\u65F6\u8BB0\u5F55\u8F93\u5165\u8282\u70B9\u3001\u5173\u7CFB\u3001\u8BC1\u636E\u4E0E\u89C4\u5219\u7248\u672C\uFF0C\u4ECE\u800C\u5141\u8BB8\u89E3\u91CA\u3001\u64A4\u9500\u548C\u91CD\u65B0\u8BA1\u7B97\u3002',\r
    source:'Canonical L3 \u89C4\u5219\u6A21\u578B', time:'\u7248\u672C\u5316',\r
    related:['EVT-005','EVT-009','RULE-INFERENCE-PROOF']\r
  },\r
  {\r
    id:'FACT-SINGLE-AUTHORITY', kind:'fact', title:'\u6743\u5A01\u4E8B\u5B9E\u53EA\u6709\u4E00\u4E2A\u5F52\u5C5E',\r
    summary:'\u77E5\u8BC6\u771F\u503C\u53EA\u7531 Canonical L3 \u6CBB\u7406\u3002',\r
    content:'\u7F13\u5B58\u3001\u5411\u91CF\u7D22\u5F15\u548C\u6FC0\u6D3B\u5B50\u56FE\u53EF\u4EE5\u4E22\u5F03\u540E\u91CD\u5EFA\uFF0C\u4E0D\u80FD\u53CD\u5411\u8986\u76D6 Canonical L3 \u4E2D\u7684\u4E8B\u5B9E\u548C\u89C4\u5219\u3002',\r
    source:'\u67B6\u6784\u7EA6\u675F', time:'\u6709\u6548',\r
    related:['EVT-001','EVT-009','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r
  },\r
  {\r
    id:'FACT-EVIDENCE-SEPARATE', kind:'fact', title:'\u8BC1\u636E\u68C0\u7D22\u4E0E\u56FE\u63A8\u7406\u89E3\u8026',\r
    summary:'\u56FE\u56DE\u7B54\u201C\u5173\u7CFB\u662F\u4EC0\u4E48\u201D\uFF0C\u6587\u6863\u901A\u9053\u56DE\u7B54\u201C\u539F\u6587\u5728\u54EA\u91CC\u201D\u3002',\r
    content:'\u4E24\u6761\u901A\u9053\u5728\u67E5\u8BE2\u89C4\u5212\u9636\u6BB5\u534F\u540C\uFF0C\u5728 EvidenceLink \u548C\u8BC1\u660E\u7ED3\u679C\u5904\u6C47\u5408\uFF1B\u4EFB\u4E00\u901A\u9053\u90FD\u4E0D\u80FD\u5192\u5145\u53E6\u4E00\u901A\u9053\u3002',\r
    source:'\u8BC1\u636E\u67B6\u6784\u7EA6\u675F', time:'\u6709\u6548',\r
    related:['EVT-002','EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED']\r
  },\r
  {\r
    id:'FACT-LOGICAL-SCOPE', kind:'fact', title:'\u5B8C\u6574\u56FE\u662F\u903B\u8F91\u63A8\u7406\u8303\u56F4',\r
    summary:'\u63A8\u7406\u53EF\u6309\u9700\u8BBF\u95EE\u5B8C\u6574\u56FE\uFF0C\u4F46\u65E0\u9700\u4E00\u6B21\u88C5\u5165\u5185\u5B58\u3002',\r
    content:'\u5173\u7CFB\u6269\u5C55\u7531\u67E5\u8BE2\u76EE\u6807\u3001\u89C4\u5219\u524D\u63D0\u3001\u65F6\u95F4\u8303\u56F4\u3001\u6743\u9650\u4E0E\u6210\u672C\u9884\u7B97\u7EA6\u675F\uFF1B\u903B\u8F91\u5B8C\u6574\u6027\u548C\u7269\u7406\u6267\u884C\u89C4\u6A21\u662F\u4E24\u4E2A\u6982\u5FF5\u3002',\r
    source:'\u63A8\u7406\u6267\u884C\u7EA6\u675F', time:'\u6709\u6548',\r
    related:['EVT-003','EVT-005','RULE-INFERENCE-PROOF']\r
  },\r
  {\r
    id:'FACT-ACTIVATED-BOUNDED', kind:'fact', title:'\u6FC0\u6D3B\u5B50\u56FE\u5FC5\u987B\u6709\u754C',\r
    summary:'\u5355\u6B21\u67E5\u8BE2\u548C\u5355\u5E27\u53EF\u89C6\u5316\u53EA\u4F7F\u7528\u6709\u9650\u5019\u9009\u96C6\u5408\u3002',\r
    content:'\u5019\u9009\u6570\u91CF\u3001\u6269\u5C55\u8DF3\u6570\u3001\u8BC1\u660E\u6DF1\u5EA6\u3001\u8D85\u65F6\u548C\u6E32\u67D3\u8282\u70B9\u6570\u90FD\u5FC5\u987B\u8BBE\u7F6E\u9884\u7B97\uFF0C\u5E76\u5728\u9700\u8981\u65F6\u7EE7\u7EED\u5206\u9875\u6269\u5C55\u3002',\r
    source:'\u8FD0\u884C\u65F6\u9884\u7B97', time:'\u6BCF\u6B21\u67E5\u8BE2',\r
    related:['EVT-003','EVT-006','EVT-012','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'FACT-ANN-RERANK', kind:'fact', title:'ANN \u53EC\u56DE\u540E\u5FC5\u987B\u91CD\u6392\u5E8F',\r
    summary:'\u5411\u91CF\u76F8\u4F3C\u5EA6\u53EA\u8D1F\u8D23\u7F29\u5C0F\u5019\u9009\uFF0C\u4E0D\u76F4\u63A5\u7B49\u4E8E\u4E8B\u5B9E\u76F8\u5173\u6027\u3002',\r
    content:'Reranker \u7EFC\u5408\u8BED\u4E49\u76F8\u4F3C\u3001\u5173\u7CFB\u8DEF\u5F84\u3001\u89C4\u5219\u53EF\u6EE1\u8DB3\u6027\u3001\u65F6\u95F4\u4E0E\u8BC1\u636E\u8D28\u91CF\uFF0C\u4EA7\u751F\u53EF\u89E3\u91CA\u7684\u6FC0\u6D3B\u4F18\u5148\u7EA7\u3002',\r
    source:'\u68C0\u7D22\u6267\u884C\u7B56\u7565', time:'\u6BCF\u6B21\u67E5\u8BE2',\r
    related:['EVT-006','EVT-007','EVT-012','ENT-GRAPH-VECTOR-INDEX','RULE-ACTIVATION-BOUND']\r
  },\r
  {\r
    id:'FACT-PROVENANCE', kind:'fact', title:'\u8BC1\u660E\u5FC5\u987B\u643A\u5E26\u6765\u6E90',\r
    summary:'\u7ED3\u8BBA\u53EF\u56DE\u6EAF\u5230 Document\u3001Chunk\u3001\u8F93\u5165\u4E8B\u5B9E\u548C\u89C4\u5219\u7248\u672C\u3002',\r
    content:'\u76F4\u63A5\u4E8B\u5B9E\u5F15\u7528 EvidenceLink\uFF1B\u6D3E\u751F\u4E8B\u5B9E\u8FD8\u8981\u4FDD\u5B58\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\uFF0C\u907F\u514D\u53EA\u8FD4\u56DE\u4E0D\u53EF\u9A8C\u8BC1\u7684\u56FE\u7ED3\u8BBA\u3002',\r
    source:'\u5BA1\u8BA1\u7EA6\u675F', time:'\u6709\u6548',\r
    related:['EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED','RULE-INFERENCE-PROOF']\r
  },\r
  {\r
    id:'FACT-STABLE-MIGRATION', kind:'fact', title:'\u8FC1\u79FB\u4FDD\u6301\u7A33\u5B9A\u6807\u8BC6',\r
    summary:'schema \u53D8\u5316\u4E0D\u6539\u5199\u65E2\u6709\u5BF9\u8C61\u548C\u8BC1\u636E\u5F15\u7528\u7684\u8EAB\u4EFD\u3002',\r
    content:'\u8FC1\u79FB\u9A8C\u8BC1\u6BD4\u8F83\u6240\u6709\u7A33\u5B9A ID \u96C6\u5408\u3001\u5BF9\u8C61\u6570\u91CF\u3001EvidenceLink subject/chunk \u6307\u9488\u4E0E\u5B8C\u6574\u6027\u7ED3\u679C\uFF0C\u518D\u5141\u8BB8\u66FF\u6362\u6B63\u5F0F\u72B6\u6001\u3002',\r
    source:'\u8FC1\u79FB\u5B89\u5168\u7EA6\u675F', time:'schema 4 \u2192 5',\r
    related:['EVT-004','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r
  },\r
  {\r
    id:'FACT-VISUAL-FUSION', kind:'fact', title:'\u5BF9\u8C61\u7C7B\u578B\u4E0D\u662F\u77E5\u8BC6\u5C42\u7EA7',\r
    summary:'\u4E8B\u4EF6\u3001\u4E8B\u5B9E\u4E0E\u89C4\u5219\u5728\u540C\u4E00\u4E2A Canonical L3 \u7A7A\u95F4\u5171\u540C\u663E\u793A\u3002',\r
    content:'\u7070\u9636\u3001\u51E0\u4F55\u5F62\u72B6\u548C\u7B5B\u9009\u5F00\u5173\u7528\u4E8E\u8FA8\u8BA4\u5BF9\u8C61\u7C7B\u578B\uFF1B\u5BF9\u8C61\u5206\u7EC4\u4EC5\u6539\u53D8\u89C2\u5BDF\u5E03\u5C40\uFF0C\u4E0D\u6539\u53D8\u56FE\u7ED3\u6784\u3001ID \u6216\u63A8\u7406\u8BED\u4E49\u3002',\r
    source:'\u53EF\u89C6\u5316\u8BED\u4E49\u7EA6\u675F', time:'V13.0',\r
    related:['EVT-010','EVT-011','RULE-VISUAL-ENCODING']\r
  }\r
];\r
\r
let canonicalSchemas = [\r
  {\r
    id:'RULE-GRAPH-AUTHORITY', kind:'rule', title:'\u6743\u5A01\u56FE\u5199\u5165\u89C4\u5219',\r
    summary:'\u4EFB\u4F55\u77E5\u8BC6\u5199\u5165\u5FC5\u987B\u843D\u5230 Canonical ID\u3001\u7248\u672C\u548C\u8BC1\u636E\u7EA6\u675F\u3002',\r
    content:'\u82E5\u5019\u9009\u5BF9\u8C61\u901A\u8FC7\u53BB\u91CD\u3001\u7C7B\u578B\u7EA6\u675F\u548C\u8BC1\u636E\u6821\u9A8C\uFF0C\u5219\u5199\u5165\u6216\u66F4\u65B0 Canonical \u8282\u70B9/\u5173\u7CFB\uFF1B\u8FD0\u884C\u65F6\u7D22\u5F15\u968F\u540E\u5F02\u6B65\u91CD\u5EFA\u3002',\r
    source:'Canonical \u89C4\u5219\u96C6', time:'ontology_version 5',\r
    related:['EVT-001','EVT-004','FACT-SINGLE-AUTHORITY','FACT-STABLE-MIGRATION']\r
  },\r
  {\r
    id:'RULE-EVIDENCE-GROUNDED', kind:'rule', title:'\u8BC1\u636E\u843D\u5730\u89C4\u5219',\r
    summary:'\u53EF\u5916\u90E8\u6838\u9A8C\u7684\u7ED3\u8BBA\u5FC5\u987B\u81F3\u5C11\u7ED1\u5B9A\u4E00\u6761\u6709\u6548 EvidenceLink\u3002',\r
    content:'\u5F53\u7ED3\u8BBA\u6765\u81EA\u6587\u6863\u4E8B\u5B9E\u65F6\uFF0C\u8BC1\u660E\u5FC5\u987B\u8FD4\u56DE Document\u3001Chunk \u4E0E\u5B9A\u4F4D\u4FE1\u606F\uFF1B\u65E0\u6765\u6E90\u7684\u76F8\u4F3C\u5019\u9009\u53EA\u80FD\u4F5C\u4E3A\u5047\u8BBE\uFF0C\u4E0D\u80FD\u5347\u7EA7\u4E3A\u5DF2\u8BC1\u4E8B\u5B9E\u3002',\r
    source:'Canonical \u89C4\u5219\u96C6', time:'ontology_version 5',\r
    related:['EVT-002','EVT-008','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE']\r
  },\r
  {\r
    id:'RULE-ACTIVATION-BOUND', kind:'rule', title:'\u6FC0\u6D3B\u9884\u7B97\u89C4\u5219',\r
    summary:'\u5019\u9009\u53EC\u56DE\u3001\u5173\u7CFB\u6269\u5C55\u4E0E\u9875\u9762\u6E32\u67D3\u90FD\u53D7\u660E\u786E\u9884\u7B97\u7EA6\u675F\u3002',\r
    content:'\u8FBE\u5230\u8282\u70B9\u3001\u8DF3\u6570\u3001\u8BC1\u660E\u6DF1\u5EA6\u6216\u8017\u65F6\u4E0A\u9650\u65F6\u6682\u505C\u6269\u5C55\u5E76\u8FD4\u56DE continuation\uFF1B\u5DF2\u52A0\u8F7D\u96C6\u5408\u4ECD\u4FDD\u6301\u53EF\u89E3\u91CA\u548C\u53EF\u5206\u9875\u3002',\r
    source:'\u67E5\u8BE2\u89C4\u5212\u89C4\u5219', time:'\u8FD0\u884C\u65F6',\r
    related:['EVT-003','EVT-006','EVT-007','EVT-012','FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK']\r
  },\r
  {\r
    id:'RULE-INFERENCE-PROOF', kind:'rule', title:'\u5B8C\u6574\u56FE\u8BC1\u660E\u89C4\u5219',\r
    summary:'\u63A8\u7406\u7ED3\u8BBA\u5FC5\u987B\u9644\u5E26\u53EF\u590D\u7B97\u7684\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\u3002',\r
    content:'\u89C4\u5219\u5F15\u64CE\u6309\u9700\u4ECE\u6FC0\u6D3B\u5B50\u56FE\u5411 Canonical L3 \u6269\u5C55\uFF0C\u8BB0\u5F55\u6BCF\u4E2A\u524D\u63D0\u3001\u5173\u7CFB\u548C\u89C4\u5219\u7248\u672C\uFF1B\u65E0\u53EF\u6EE1\u8DB3\u8BC1\u660E\u65F6\u4E0D\u8F93\u51FA\u786E\u5B9A\u6027\u7ED3\u8BBA\u3002',\r
    source:'\u63A8\u7406\u89C4\u5219\u96C6', time:'\u7248\u672C\u5316',\r
    related:['EVT-005','EVT-009','FACT-LOGICAL-SCOPE','FACT-PROVENANCE','ENT-CANONICAL-RULE']\r
  },\r
  {\r
    id:'RULE-VISUAL-ENCODING', kind:'pattern', title:'Canonical \u89C6\u56FE\u7F16\u7801\u6A21\u5F0F',\r
    summary:'\u4E00\u4E2A\u56FE\u8FB9\u754C\u3001\u4E09\u79CD\u5BF9\u8C61\u5F62\u72B6\u3001\u5168\u7A0B\u9ED1\u767D\u7070\u3002',\r
    content:'\u4E8B\u4EF6\u4F7F\u7528\u77F3\u58A8\u9ED1\u5FAE\u70B9\uFF0C\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\u4F7F\u7528\u4E2D\u7070\u7EBF\u6846\u51E0\u4F55\uFF0C\u6A21\u5F0F\u4E0E\u89C4\u5219\u4F7F\u7528\u6D45\u7070\u591A\u9762\u4F53\uFF1B\u660E\u6697\u548C\u5C3A\u5BF8\u53EA\u8868\u793A\u6FC0\u6D3B\u5F3A\u5EA6\u3002',\r
    source:'V13.0 \u524D\u7AEF\u6A21\u5F0F', time:'\u7248\u672C\u5316',\r
    related:['EVT-010','EVT-011','FACT-VISUAL-FUSION']\r
  }\r
];\r
\r
// -----------------------------\r
// Canonical L3 \u5355\u56FE\u7A7A\u95F4\u5E03\u5C40\r
// -----------------------------\r
const memoryCenter = new THREE.Vector3(0, 0.45, -1.15);\r
memoryRoot.position.copy(memoryCenter);\r
\r
const memoryKindStyle = {\r
  event: {\r
    color: 0x242424,\r
    shellOpacity: 0.58,\r
    nodeOpacity: 0.92,\r
    label: new THREE.Vector3(-7.2, 7.6, 3.4)\r
  },\r
  fact: {\r
    color: 0x707070,\r
    shellOpacity: 0.52,\r
    nodeOpacity: 0.94,\r
    label: new THREE.Vector3(0, 7.9, 3.4)\r
  },\r
  schema: {\r
    color: 0xb8b8b8,\r
    shellOpacity: 0.14,\r
    nodeOpacity: 0.88,\r
    label: new THREE.Vector3(7.2, 7.6, 3.4)\r
  }\r
};\r
\r
const memoryKindLayout = {\r
  fused: {\r
    event: {\r
      offset: new THREE.Vector3(0, 0, 0),\r
      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90),\r
      label: new THREE.Vector3(0, 7.35, 3.35)\r
    },\r
    fact: {\r
      offset: new THREE.Vector3(0, 0, 0),\r
      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)\r
    },\r
    schema: {\r
      offset: new THREE.Vector3(0, 0, 0),\r
      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)\r
    }\r
  },\r
  grouped: {\r
    event: {\r
      offset: new THREE.Vector3(-7.0, 0.25, 0.4),\r
      radii: new THREE.Vector3(3.9, 6.55, 3.55),\r
      shellScale: new THREE.Vector3(4.35, 6.95, 3.85)\r
    },\r
    fact: {\r
      offset: new THREE.Vector3(0, 0.20, 0.8),\r
      radii: new THREE.Vector3(3.85, 5.55, 3.50),\r
      shellScale: new THREE.Vector3(4.35, 5.95, 3.85)\r
    },\r
    schema: {\r
      offset: new THREE.Vector3(7.0, 0.25, 1.2),\r
      radii: new THREE.Vector3(3.45, 4.65, 3.20),\r
      shellScale: new THREE.Vector3(3.95, 5.05, 3.55)\r
    }\r
  }\r
};\r
\r
const memoryKindLabelText = {\r
  event: { full: '\u4E8B\u4EF6\u5BF9\u8C61 \xB7 \u77F3\u58A8\u5FAE\u70B9', compact: '\u4E8B\u4EF6' },\r
  fact: { full: '\u5B9E\u4F53 / \u4E8B\u5B9E \xB7 \u4E2D\u7070\u7EBF\u6846', compact: '\u5B9E\u4F53 / \u4E8B\u5B9E' },\r
  schema: { full: '\u6A21\u5F0F / \u89C4\u5219 \xB7 \u6D45\u7070\u591A\u9762\u4F53', compact: '\u6A21\u5F0F / \u89C4\u5219' }\r
};\r
\r
// \u7A84\u5C4F\u5206\u7EC4\u89C2\u5BDF\u65F6\u6536\u7A84\u4E09\u5217\u6A2A\u5411\u5360\u7528\uFF0C\u907F\u514D\u4E24\u4FA7\u5BF9\u8C61\u88AB\u6B63\u9762\u89C6\u89D2\u88C1\u51FA\u5C4F\u5E55\u3002\r
const memoryKindLayoutCompact = {\r
  grouped: {\r
    event: {\r
      offset: new THREE.Vector3(-1.65, 0.18, 0.40),\r
      radii: new THREE.Vector3(1.35, 5.35, 2.80),\r
      shellScale: new THREE.Vector3(1.70, 5.70, 3.10),\r
      label: new THREE.Vector3(-1.10, 7.25, 3.30)\r
    },\r
    fact: {\r
      offset: new THREE.Vector3(0, 0.16, 0.62),\r
      radii: new THREE.Vector3(1.30, 4.75, 2.65),\r
      shellScale: new THREE.Vector3(1.65, 5.10, 2.95),\r
      label: new THREE.Vector3(0, 7.55, 3.30)\r
    },\r
    schema: {\r
      offset: new THREE.Vector3(1.65, 0.18, 0.86),\r
      radii: new THREE.Vector3(1.25, 4.20, 2.45),\r
      shellScale: new THREE.Vector3(1.60, 4.60, 2.80),\r
      label: new THREE.Vector3(1.10, 7.25, 3.30)\r
    }\r
  }\r
};\r
\r
function makeMemoryShell(layer) {\r
  const shell = new THREE.Group();\r
  shell.userData.memoryKind = layer;\r
\r
  if (layer === 'event') {\r
    const positions = [];\r
    const count = 210;\r
    for (let i = 0; i < count; i++) {\r
      const point = ellipsoidPoint(i, count, new THREE.Vector3(1, 1, 1), 0.35);\r
      positions.push(point.x, point.y, point.z);\r
    }\r
    const geometry = new THREE.BufferGeometry();\r
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));\r
    const material = new THREE.PointsMaterial({\r
      color: memoryKindStyle.event.color,\r
      size: 0.11,\r
      transparent: true,\r
      opacity: memoryKindStyle.event.shellOpacity,\r
      sizeAttenuation: true,\r
      depthTest: false,\r
      depthWrite: false\r
    });\r
    const points = new THREE.Points(geometry, material);\r
    points.renderOrder = 7;\r
    shell.add(points);\r
  } else if (layer === 'fact') {\r
    const geometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 1));\r
    const material = new THREE.LineDashedMaterial({\r
      color: memoryKindStyle.fact.color,\r
      dashSize: 0.08,\r
      gapSize: 0.055,\r
      transparent: true,\r
      opacity: memoryKindStyle.fact.shellOpacity,\r
      depthTest: false,\r
      depthWrite: false\r
    });\r
    const scaffold = new THREE.LineSegments(geometry, material);\r
    scaffold.computeLineDistances();\r
    scaffold.renderOrder = 8;\r
    shell.add(scaffold);\r
  } else {\r
    const geometry = new THREE.IcosahedronGeometry(1, 2);\r
    const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({\r
      color: memoryKindStyle.schema.color,\r
      transparent: true,\r
      opacity: memoryKindStyle.schema.shellOpacity,\r
      depthTest: false,\r
      depthWrite: false,\r
      side: THREE.DoubleSide\r
    }));\r
    fill.renderOrder = 7;\r
    shell.add(fill);\r
\r
    const outline = new THREE.LineSegments(\r
      new THREE.WireframeGeometry(geometry),\r
      new THREE.LineBasicMaterial({\r
        color: 0x555555,\r
        transparent: true,\r
        opacity: 0.32,\r
        depthTest: false,\r
        depthWrite: false\r
      })\r
    );\r
    outline.renderOrder = 8;\r
    shell.add(outline);\r
  }\r
\r
  memoryShellGroup.add(shell);\r
  return shell;\r
}\r
\r
const canonicalShell = makeMemoryShell('event');\r
const factGuide = makeMemoryShell('fact');\r
const schemaGuide = makeMemoryShell('schema');\r
\r
function syncMemoryGuides() {\r
  canonicalShell.visible = memoryVisible && (!memoryGrouped || eventKindVisible);\r
  factGuide.visible = memoryVisible && memoryGrouped && factKindVisible;\r
  schemaGuide.visible = memoryVisible && memoryGrouped && schemaKindVisible;\r
\r
  const boundaryMaterial = canonicalShell.children[0]?.material;\r
  if (boundaryMaterial) {\r
    boundaryMaterial.color.setHex(memoryGrouped\r
      ? memoryKindStyle.event.color\r
      : 0x8a8a8a);\r
    boundaryMaterial.opacity = memoryGrouped\r
      ? memoryKindStyle.event.shellOpacity\r
      : 0.22;\r
  }\r
}\r
\r
// -----------------------------\r
// \u8282\u70B9\u5E03\u5C40\r
// -----------------------------\r
function ellipsoidPoint(index, count, radii, phase=0) {\r
  // Fibonacci sphere\uFF0C\u6620\u5C04\u5230\u692D\u7403\u8868\u9762\uFF0C\u907F\u514D\u89C4\u5219\u7ECF\u7EAC\u7EBF\u5806\u53E0\u3002\r
  const golden = Math.PI * (3 - Math.sqrt(5));\r
  const y = 1 - (index / Math.max(1, count - 1)) * 2;\r
  const r = Math.sqrt(Math.max(0, 1 - y*y));\r
  const theta = golden * index + phase;\r
\r
  return new THREE.Vector3(\r
    Math.cos(theta) * r * radii.x,\r
    y * radii.y,\r
    Math.sin(theta) * r * radii.z\r
  );\r
}\r
\r
function stableUnit(value) {\r
  let hash = 2166136261;\r
  for (let i = 0; i < value.length; i++) {\r
    hash ^= value.charCodeAt(i);\r
    hash = Math.imul(hash, 16777619);\r
  }\r
  hash ^= hash >>> 16;\r
  hash = Math.imul(hash, 0x7feb352d);\r
  hash ^= hash >>> 15;\r
  return (hash >>> 0) / 4294967295;\r
}\r
\r
function canonicalVolumePoint(nodeId, radii) {\r
  const longitude = stableUnit(nodeId + ':longitude') * Math.PI * 2;\r
  const z = stableUnit(nodeId + ':latitude') * 2 - 1;\r
  const plane = Math.sqrt(Math.max(0, 1 - z * z));\r
  const radius = 0.30 + Math.cbrt(stableUnit(nodeId + ':radius')) * 0.68;\r
\r
  return new THREE.Vector3(\r
    Math.cos(longitude) * plane * radii.x * radius,\r
    z * radii.y * radius,\r
    Math.sin(longitude) * plane * radii.z * radius\r
  );\r
}\r
\r
function groupedVolumePoint(index, count, radii, phase=0) {\r
  const point = ellipsoidPoint(index, count, radii, phase);\r
  const radius = 0.48 + (((index + 1) * 0.61803398875 + phase) % 1) * 0.48;\r
  return point.multiplyScalar(radius);\r
}\r
\r
function activeMemoryLayout() {\r
  if (!memoryGrouped) return memoryKindLayout.fused;\r
  return window.innerWidth <= 700\r
    ? memoryKindLayoutCompact.grouped\r
    : memoryKindLayout.grouped;\r
}\r
\r
function memoryNodePoint(layer, index, count, phase=0, nodeId='') {\r
  const layout = activeMemoryLayout()[layer];\r
  const point = memoryGrouped\r
    ? groupedVolumePoint(index, count, layout.radii, phase)\r
    : canonicalVolumePoint(nodeId, layout.radii);\r
  return point.add(layout.offset);\r
}\r
\r
function makeNodeMesh(data, layer, index, count) {\r
  let geo;\r
  let material;\r
  let radii;\r
  let phase = 0;\r
\r
  if (layer === 'event') {\r
    // \u8BED\u4E49\u4E8B\u4EF6\u6539\u6210\u201C\u795E\u7ECF\u5143\u5F0F\u5FAE\u8282\u70B9\u201D\uFF1A\r
    // \u4E8B\u4EF6\u6570\u91CF\u672A\u6765\u53EF\u80FD\u975E\u5E38\u5927\uFF0C\u56E0\u6B64\u5FC5\u987B\u8F7B\u3001\u5C0F\u3001\u5BC6\uFF0C\u800C\u4E0D\u662F\u5360\u7A7A\u95F4\u7684\u5927\u7ACB\u65B9\u4F53\u3002\r
    geo = new THREE.SphereGeometry(0.145, 7, 7);\r
    material = new THREE.MeshBasicMaterial({\r
      color: memoryKindStyle.event.color,\r
      transparent: true,\r
      opacity: memoryKindStyle.event.nodeOpacity,\r
      depthTest: false,\r
      depthWrite: false\r
    });\r
    phase = 0.2;\r
  } else if (layer === 'fact') {\r
    geo = new THREE.OctahedronGeometry(0.46,0);\r
    material = new THREE.MeshBasicMaterial({\r
      color: memoryKindStyle.fact.color,\r
      wireframe: true,\r
      transparent: true,\r
      opacity: memoryKindStyle.fact.nodeOpacity,\r
      depthTest: false,\r
      depthWrite: false\r
    });\r
    phase = 1.1;\r
  } else {\r
    geo = new THREE.IcosahedronGeometry(0.58,0);\r
    material = new THREE.MeshBasicMaterial({\r
      color: memoryKindStyle.schema.color,\r
      transparent: true,\r
      opacity: memoryKindStyle.schema.nodeOpacity,\r
      depthTest: false,\r
      depthWrite: false\r
    });\r
    radii = new THREE.Vector3(3.18,2.38,2.70);\r
    phase = 2.0;\r
  }\r
\r
  const mesh = new THREE.Mesh(geo, material);\r
  if (layer === 'schema') {\r
    const outline = new THREE.LineSegments(\r
      new THREE.EdgesGeometry(geo),\r
      new THREE.LineBasicMaterial({\r
        color: 0x555555,\r
        transparent: true,\r
        opacity: 0.72,\r
        depthTest: false,\r
        depthWrite: false\r
      })\r
    );\r
    outline.renderOrder = 37;\r
    mesh.add(outline);\r
  }\r
  mesh.position.copy(memoryNodePoint(layer, index, count, phase, data.id));\r
  mesh.renderOrder =\r
    layer === 'event' ? 32 :\r
    layer === 'fact' ? 34 : 36;\r
  mesh.userData.memoryData = data;\r
  mesh.userData.memoryKind = layer;\r
  mesh.userData.layoutIndex = index;\r
  mesh.userData.layoutCount = count;\r
  mesh.userData.layoutPhase = phase;\r
  mesh.userData.baseScale = 1;\r
  mesh.userData.baseOpacity = material.opacity;\r
  mesh.userData.baseColor = memoryKindStyle[layer].color;\r
\r
  data._position = mesh.position.clone();\r
\r
  memoryClickable.push(mesh);\r
  memoryNodeById.set(data.id, mesh);\r
\r
  if (layer === 'event') memoryKindEvent.add(mesh);\r
  if (layer === 'fact') memoryKindFact.add(mesh);\r
  if (layer === 'schema') memoryKindSchema.add(mesh);\r
\r
  return mesh;\r
}\r
\r
canonicalEvents.forEach((d,i)=>makeNodeMesh(d,'event',i,canonicalEvents.length));\r
canonicalFacts.forEach((d,i)=>makeNodeMesh(d,'fact',i,canonicalFacts.length));\r
canonicalSchemas.forEach((d,i)=>makeNodeMesh(d,'schema',i,canonicalSchemas.length));\r
\r
function updateMemoryKindLabels() {\r
  const layout = activeMemoryLayout();\r
  const compact = memoryGrouped && window.innerWidth <= 700;\r
  const labels = {\r
    event: document.getElementById('memoryKindEventLabel'),\r
    fact: document.getElementById('memoryKindFactLabel'),\r
    schema: document.getElementById('memoryKindSchemaLabel')\r
  };\r
\r
  Object.entries(labels).forEach(([layer, element]) => {\r
    element.textContent = memoryGrouped\r
      ? memoryKindLabelText[layer][compact ? 'compact' : 'full']\r
      : (layer === 'event' ? 'Canonical L3 \xB7 \u5F53\u524D\u6FC0\u6D3B\u5B50\u56FE' : '');\r
    const anchor = layout[layer].label ||\r
      layout[layer].offset.clone().add(new THREE.Vector3(0, layout[layer].radii.y + 1.0, 3.2));\r
    memoryKindLabelWorld[layer].copy(memoryCenter).add(anchor)\r
      .multiplyScalar(1.24).add(brainRoot.position);\r
    element.dataset.layout = memoryGrouped ? 'grouped' : 'fused';\r
  });\r
}\r
\r
function updateMemoryShellLayout() {\r
  const layout = activeMemoryLayout();\r
  [\r
    ['event', canonicalShell],\r
    ['fact', factGuide],\r
    ['schema', schemaGuide]\r
  ].forEach(([layer, shell]) => {\r
    shell.position.copy(layout[layer].offset);\r
    shell.scale.copy(layout[layer].shellScale);\r
  });\r
  syncMemoryGuides();\r
}\r
\r
function updateMemoryLineGeometry(line) {\r
  const from = memoryNodeById.get(line.userData.fromId);\r
  const to = memoryNodeById.get(line.userData.toId);\r
  if (!from || !to) return;\r
\r
  const position = line.geometry.getAttribute('position');\r
  position.setXYZ(0, from.position.x, from.position.y, from.position.z);\r
  position.setXYZ(1, to.position.x, to.position.y, to.position.z);\r
  position.needsUpdate = true;\r
  line.geometry.computeBoundingSphere();\r
  if (line.material.isLineDashedMaterial) line.computeLineDistances();\r
}\r
\r
function updateMemoryLinkGeometry() {\r
  memoryLinkMeshes.forEach(updateMemoryLineGeometry);\r
\r
  memoryIndexLinks.forEach(line => {\r
    const target = memoryNodeById.get(line.userData.targetId);\r
    if (!target) return;\r
    const position = line.geometry.getAttribute('position');\r
    position.setXYZ(1, target.position.x, target.position.y, target.position.z);\r
    position.needsUpdate = true;\r
    line.geometry.computeBoundingSphere();\r
  });\r
\r
  if (typeof chainGuideGroup !== 'undefined') {\r
    chainGuideGroup.children.forEach(updateMemoryLineGeometry);\r
  }\r
}\r
\r
function updateMemoryLayout() {\r
  memoryClickable.forEach(mesh => {\r
    mesh.position.copy(memoryNodePoint(\r
      mesh.userData.memoryKind,\r
      mesh.userData.layoutIndex,\r
      mesh.userData.layoutCount,\r
      mesh.userData.layoutPhase,\r
      mesh.userData.memoryData.id\r
    ));\r
    mesh.userData.basePosition = mesh.position.clone();\r
  });\r
\r
  updateMemoryShellLayout();\r
  updateMemoryLinkGeometry();\r
  updateMemoryKindLabels();\r
}\r
\r
// -----------------------------\r
// Canonical L3 \u5BF9\u8C61\u95F4\u5173\u7CFB\u7EBF\r
// -----------------------------\r
function addMemoryLink(fromId, toId, kind) {\r
  const a = memoryNodeById.get(fromId);\r
  const b = memoryNodeById.get(toId);\r
  if (!a || !b) return;\r
\r
  const geo = new THREE.BufferGeometry().setFromPoints([\r
    a.position.clone(),\r
    b.position.clone()\r
  ]);\r
\r
  const baseOpacity = kind === 'event-fact' ? 0.16 :\r
    kind === 'fact-schema' ? 0.28 : 0.22;\r
  const materialOptions = {\r
    color: kind === 'event-fact'\r
      ? memoryKindStyle.event.color\r
      : memoryKindStyle.fact.color,\r
    transparent: true,\r
    opacity: baseOpacity,\r
    depthTest: false\r
  };\r
  const mat = kind === 'event-fact'\r
    ? new THREE.LineDashedMaterial({\r
        ...materialOptions,\r
        dashSize: 0.22,\r
        gapSize: 0.16\r
      })\r
    : new THREE.LineBasicMaterial(materialOptions);\r
\r
  const line = new THREE.Line(geo,mat);\r
  line.renderOrder = 10;\r
  line.userData.fromId = fromId;\r
  line.userData.toId = toId;\r
  line.userData.kind = kind;\r
  line.userData.baseOpacity = baseOpacity;\r
  if (mat.isLineDashedMaterial) line.computeLineDistances();\r
\r
  if (kind === 'event-fact') memoryLinkEventFact.add(line);\r
  else memoryLinkFactSchema.add(line);\r
\r
  memoryLinkMeshes.push(line);\r
}\r
\r
// \u67E5\u8BE2\u951A\u70B9 / \u4E8B\u4EF6 -> \u76F8\u5173\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\r
canonicalEvents.forEach(event => {\r
  event.related\r
    .filter(id => id.startsWith('ENT-') || id.startsWith('FACT-'))\r
    .slice(0,2)\r
    .forEach(id => addMemoryLink(event.id,id,'event-fact'));\r
});\r
\r
// \u5B9E\u4F53\u4E0E\u4E8B\u5B9E -> \u53EF\u6EE1\u8DB3\u7684\u6A21\u5F0F\u4E0E\u89C4\u5219\r
canonicalFacts.forEach(node => {\r
  node.related\r
    .filter(id => id.startsWith('RULE-'))\r
    .slice(0,2)\r
    .forEach(id => addMemoryLink(node.id,id,'fact-schema'));\r
});\r
\r
// -----------------------------\r
// \u6D77\u9A6C\u4F53 -> \u4E8B\u4EF6\u5BF9\u8C61\u7684\u89C6\u89C9\u7D22\u5F15\u7EBF\uFF1B\u4EC5\u7528\u4E8E\u8111\u5185\u53D9\u4E8B\uFF0C\u4E0D\u8868\u793A\u5B58\u50A8\u5C42\u7EA7\u3002\r
// -----------------------------\r
const hippocampusIndexGroup = new THREE.Group();\r
memoryRoot.add(hippocampusIndexGroup);\r
\r
[\r
  new THREE.Vector3(-4.7,-1.0,-1.5).sub(memoryCenter),\r
  new THREE.Vector3(4.7,-1.0,-1.5).sub(memoryCenter)\r
].forEach((hip, sideIndex) => {\r
  canonicalEvents.forEach((event,i) => {\r
    if ((i % 2) !== sideIndex) return;\r
    const target = memoryNodeById.get(event.id);\r
    if (!target) return;\r
\r
    const geo = new THREE.BufferGeometry().setFromPoints([\r
      hip,\r
      target.position.clone()\r
    ]);\r
    const mat = new THREE.LineBasicMaterial({\r
      color:0x000000,\r
      transparent:true,\r
      opacity:0.014,\r
      depthTest:false\r
    });\r
    const l = new THREE.Line(geo,mat);\r
    l.renderOrder = 9;\r
    l.userData.targetId = event.id;\r
    hippocampusIndexGroup.add(l);\r
    memoryIndexLinks.push(l);\r
  });\r
});\r
\r
function clearThreeGroup(group) {\r
  while (group.children.length) {\r
    const object = group.children.pop();\r
    object.traverse?.((child) => {\r
      if (child.geometry) child.geometry.dispose();\r
      if (child.material) {\r
        const materials = Array.isArray(child.material) ? child.material : [child.material];\r
        materials.forEach((material) => material.dispose?.());\r
      }\r
    });\r
  }\r
}\r
\r
function rebuildCanonicalScene() {\r
  [memoryKindEvent, memoryKindFact, memoryKindSchema,\r
    memoryLinkEventFact, memoryLinkFactSchema, hippocampusIndexGroup]\r
    .forEach(clearThreeGroup);\r
  memoryClickable.length = 0;\r
  memoryNodeById.clear();\r
  memoryLinkMeshes.length = 0;\r
  memoryIndexLinks.length = 0;\r
  clearChainGuide();\r
  selectedMemoryMesh = null;\r
  selectedMemoryData = null;\r
\r
  canonicalEvents.forEach((data, index) =>\r
    makeNodeMesh(data, 'event', index, canonicalEvents.length));\r
  canonicalFacts.forEach((data, index) =>\r
    makeNodeMesh(data, 'fact', index, canonicalFacts.length));\r
  canonicalSchemas.forEach((data, index) =>\r
    makeNodeMesh(data, 'schema', index, canonicalSchemas.length));\r
\r
  if (canonicalSnapshot?.relations?.length) {\r
    canonicalSnapshot.relations.forEach((relation) => {\r
      const from = memoryNodeById.get(relation.source_node_id);\r
      const to = memoryNodeById.get(relation.target_node_id);\r
      if (!from || !to) return;\r
      const fromKind = from.userData.memoryKind;\r
      const toKind = to.userData.memoryKind;\r
      const kind = fromKind === 'event' && toKind === 'fact'\r
        ? 'event-fact'\r
        : fromKind === 'fact' && toKind === 'schema'\r
          ? 'fact-schema'\r
          : 'canonical';\r
      addMemoryLink(relation.source_node_id, relation.target_node_id, kind);\r
    });\r
  } else {\r
    canonicalEvents.forEach((event) => {\r
      event.related\r
        .filter((id) => id.startsWith('ENT-') || id.startsWith('FACT-'))\r
        .slice(0, 2)\r
        .forEach((id) => addMemoryLink(event.id, id, 'event-fact'));\r
    });\r
    canonicalFacts.forEach((node) => {\r
      node.related\r
        .filter((id) => id.startsWith('RULE-'))\r
        .slice(0, 2)\r
        .forEach((id) => addMemoryLink(node.id, id, 'fact-schema'));\r
    });\r
  }\r
\r
  [\r
    new THREE.Vector3(-4.7, -1.0, -1.5).sub(memoryCenter),\r
    new THREE.Vector3(4.7, -1.0, -1.5).sub(memoryCenter),\r
  ].forEach((hip, sideIndex) => {\r
    canonicalEvents.forEach((event, index) => {\r
      if ((index % 2) !== sideIndex) return;\r
      const target = memoryNodeById.get(event.id);\r
      if (!target) return;\r
      const geometry = new THREE.BufferGeometry().setFromPoints([\r
        hip,\r
        target.position.clone(),\r
      ]);\r
      const material = new THREE.LineBasicMaterial({\r
        color: 0x000000,\r
        transparent: true,\r
        opacity: 0.014,\r
        depthTest: false,\r
      });\r
      const line = new THREE.Line(geometry, material);\r
      line.renderOrder = 9;\r
      line.userData.targetId = event.id;\r
      hippocampusIndexGroup.add(line);\r
      memoryIndexLinks.push(line);\r
    });\r
  });\r
  updateMemoryLayout();\r
  syncMemoryKindLabelVisibility();\r
  refreshBrainOcclusion();\r
}\r
\r
// -----------------------------\r
// \u8BE6\u60C5\u9762\u677F\r
// -----------------------------\r
const memoryPanel = document.getElementById('memoryPanel');\r
\r
function setPanelText(id, value) {\r
  const el = document.getElementById(id);\r
  el.textContent = value ?? '\u2014';\r
}\r
\r
function openMemoryPanel(data, mesh) {\r
  selectedMemoryData = data;\r
  setSelectedMemoryMesh(mesh);\r
\r
  const objectGroupNames = {\r
    event:'Canonical L3 \xB7 \u4E8B\u4EF6\u5BF9\u8C61',\r
    fact:'Canonical L3 \xB7 \u5B9E\u4F53 / \u4E8B\u5B9E',\r
    schema:'Canonical L3 \xB7 \u6A21\u5F0F / \u89C4\u5219'\r
  };\r
  const nodeKindNames = {\r
    event:'\u4E8B\u4EF6',\r
    entity:'\u5B9E\u4F53',\r
    fact:'\u4E8B\u5B9E',\r
    rule:'\u89C4\u5219',\r
    pattern:'\u6A21\u5F0F'\r
  };\r
\r
  const layer = mesh.userData.memoryKind;\r
  memoryPanel.dataset.layer = layer;\r
\r
  setPanelText('memoryPanelKicker', objectGroupNames[layer] || 'CANONICAL NODE');\r
  setPanelText('memoryPanelTitle', data.title);\r
  setPanelText('memoryPanelId', data.id + ' / ' + (nodeKindNames[data.kind] || objectGroupNames[layer] || layer));\r
  setPanelText('memoryPanelSummary', data.summary);\r
  setPanelText('memoryPanelContent', data.content);\r
  setPanelText('memoryPanelSource', \`\${data.source || '\u2014'}\\n\${data.time || ''}\`);\r
  setPanelText('memoryPanelRelations', (data.related || []).join('  \xB7  ') || '\u2014');\r
\r
  memoryPanel.classList.remove('hidden');\r
  highlightMemoryRelations(data.id);\r
  render();\r
}\r
\r
function closeMemoryPanel() {\r
  memoryPanel.classList.add('hidden');\r
  memoryPanel.dataset.layer = '';\r
  selectedMemoryData = null;\r
  setSelectedMemoryMesh(null);\r
  resetMemoryLinkHighlight();\r
  render();\r
}\r
\r
function memorySelectedScale(mesh) {\r
  if (!mesh) return 1;\r
  const layer = mesh.userData.memoryKind;\r
  if (layer === 'event') return 2.15;\r
  if (layer === 'fact') return 1.55;\r
  return 1.40;\r
}\r
\r
function setSelectedMemoryMesh(mesh) {\r
  if (selectedMemoryMesh && selectedMemoryMesh !== mesh) {\r
    selectedMemoryMesh.scale.setScalar(1);\r
  }\r
\r
  selectedMemoryMesh = mesh;\r
\r
  if (selectedMemoryMesh) {\r
    selectedMemoryMesh.scale.setScalar(memorySelectedScale(selectedMemoryMesh));\r
  }\r
}\r
\r
function resetMemoryLinkHighlight() {\r
  memoryLinkMeshes.forEach(line => {\r
    line.material.opacity = line.userData.baseOpacity;\r
  });\r
\r
  memoryClickable.forEach(mesh => {\r
    if (mesh !== selectedMemoryMesh) mesh.scale.setScalar(1);\r
  });\r
}\r
\r
function highlightMemoryRelations(id) {\r
  memoryLinkMeshes.forEach(line => {\r
    const connected = line.userData.fromId === id || line.userData.toId === id;\r
    line.material.opacity = connected ? 0.74 : 0.025;\r
\r
    if (connected) {\r
      const otherId = line.userData.fromId === id ? line.userData.toId : line.userData.fromId;\r
      const other = memoryNodeById.get(otherId);\r
      if (other && other !== selectedMemoryMesh) {\r
        const otherLayer = other.userData.memoryKind;\r
        other.scale.setScalar(otherLayer === 'event' ? 1.55 : 1.22);\r
      }\r
    }\r
  });\r
}\r
\r
document.getElementById('memoryPanelClose').addEventListener('click', closeMemoryPanel);\r
\r
document.getElementById('focusMemoryNodeBtn').addEventListener('click', () => {\r
  if (!selectedMemoryMesh) return;\r
\r
  const world = new THREE.Vector3();\r
  selectedMemoryMesh.getWorldPosition(world);\r
\r
  controls.target.copy(world);\r
  camera.position.copy(\r
    world.clone().add(new THREE.Vector3(0,3.4,15.5))\r
  );\r
  controls.update();\r
  render();\r
});\r
\r
document.getElementById('traceMemoryNodeBtn').addEventListener('click', () => {\r
  if (!selectedMemoryData) return;\r
  highlightMemoryRelations(selectedMemoryData.id);\r
  setMemoryStatus(\`\u6B63\u5728\u8FFD\u8E2A\uFF1A\${selectedMemoryData.title}\`);\r
  render();\r
});\r
\r
// -----------------------------\r
// \u70B9\u51FB\u68C0\u6D4B\r
// -----------------------------\r
const memoryRaycaster = new THREE.Raycaster();\r
const memoryPointer = new THREE.Vector2();\r
let pointerDownXY = null;\r
\r
renderer.domElement.addEventListener('pointerdown', (ev) => {\r
  pointerDownXY = {x:ev.clientX,y:ev.clientY};\r
});\r
\r
renderer.domElement.addEventListener('pointerup', (ev) => {\r
  if (!pointerDownXY || !memoryVisible) return;\r
\r
  const dx = ev.clientX - pointerDownXY.x;\r
  const dy = ev.clientY - pointerDownXY.y;\r
  pointerDownXY = null;\r
\r
  if (Math.hypot(dx,dy) > 5) return;\r
\r
  const rect = renderer.domElement.getBoundingClientRect();\r
  memoryPointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;\r
  memoryPointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;\r
\r
  memoryRaycaster.setFromCamera(memoryPointer,camera);\r
\r
  const visibleNodes = memoryClickable.filter(m => m.visible && m.parent && m.parent.visible);\r
  const hits = memoryRaycaster.intersectObjects(visibleNodes,false);\r
\r
  if (hits.length) {\r
    openMemoryPanel(hits[0].object.userData.memoryData,hits[0].object);\r
  }\r
});\r
\r
// -----------------------------\r
// Canonical L3 \u89C6\u56FE\u4E0E\u5BF9\u8C61\u7C7B\u578B\u5F00\u5173\r
// -----------------------------\r
function setMemoryStatus(text) {\r
  document.getElementById('memoryStatus').textContent = 'Canonical L3\uFF1A' + text;\r
}\r
\r
function memoryIdleStatus() {\r
  const layout = memoryGrouped ? '\u5BF9\u8C61\u5206\u7EC4\u89C2\u5BDF' : '\u5168\u56FE\u878D\u5408';\r
  const source = canonicalSnapshot\r
    ? \`\u771F\u5B9E\u5FEB\u7167 \${canonicalSnapshot.snapshot_version} \xB7 \`\r
    : '';\r
  return source + '\u5B8C\u6574\u56FE \xB7 ' + layout + (memoryXrayEnabled ? ' \xB7 \u900F\u89C6' : '');\r
}\r
\r
function syncMemoryKindLabelVisibility() {\r
  const eventLabel = document.getElementById('memoryKindEventLabel');\r
  const factLabel = document.getElementById('memoryKindFactLabel');\r
  const schemaLabel = document.getElementById('memoryKindSchemaLabel');\r
\r
  eventLabel.classList.toggle('hidden', !memoryVisible || (memoryGrouped && !eventKindVisible));\r
  factLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !factKindVisible);\r
  schemaLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !schemaKindVisible);\r
}\r
\r
function updateMemoryVisibility(show) {\r
  memoryVisible = show;\r
  memoryRoot.visible = show;\r
  memoryShellGroup.visible = show;\r
\r
  const btn = document.getElementById('toggleMemoryBtn');\r
  btn.textContent = show ? 'Canonical \u56FE\u5F00' : 'Canonical \u56FE\u5173';\r
  btn.classList.toggle('active',show);\r
\r
  syncMemoryGuides();\r
  syncMemoryKindLabelVisibility();\r
\r
  if (!show) closeMemoryPanel();\r
\r
  refreshBrainOcclusion();\r
  setMemoryStatus(show ? memoryIdleStatus() : '\u5173\u95ED');\r
  render();\r
}\r
\r
function updateMemoryXray(show) {\r
  memoryXrayEnabled = show;\r
\r
  const btn = document.getElementById('memoryXrayBtn');\r
  btn.textContent = show ? '\u56FE\u8C31\u900F\u89C6\u5F00' : '\u56FE\u8C31\u900F\u89C6\u5173';\r
  btn.classList.toggle('active',show);\r
\r
  refreshBrainOcclusion();\r
  setMemoryStatus(memoryVisible ? memoryIdleStatus() : '\u5173\u95ED');\r
  render();\r
}\r
\r
function updateObjectGrouping(show) {\r
  memoryGrouped = show;\r
\r
  const btn = document.getElementById('toggleObjectGroupingBtn');\r
  btn.textContent = show ? '\u5BF9\u8C61\u5206\u7EC4\u5F00' : '\u5BF9\u8C61\u5206\u7EC4';\r
  btn.classList.toggle('active', show);\r
  btn.setAttribute('aria-pressed', String(show));\r
\r
  memoryShellGroup.visible = memoryVisible;\r
  updateMemoryLayout();\r
  syncMemoryKindLabelVisibility();\r
  refreshBrainOcclusion();\r
  setMemoryStatus(memoryIdleStatus());\r
  render();\r
}\r
\r
function updateEventKind(show) {\r
  eventKindVisible = show;\r
  memoryKindEvent.visible = show;\r
  hippocampusIndexGroup.visible = show;\r
  memoryLinkEventFact.visible = show && factKindVisible;\r
\r
  const btn = document.getElementById('toggleEventKindBtn');\r
  btn.classList.toggle('active',show);\r
  btn.setAttribute('aria-pressed', String(show));\r
\r
  syncMemoryGuides();\r
  syncMemoryKindLabelVisibility();\r
  render();\r
}\r
\r
function updateFactKind(show) {\r
  factKindVisible = show;\r
  memoryKindFact.visible = show;\r
  memoryLinkEventFact.visible = show && eventKindVisible;\r
  memoryLinkFactSchema.visible = show && schemaKindVisible;\r
\r
  const btn = document.getElementById('toggleFactKindBtn');\r
  btn.classList.toggle('active',show);\r
  btn.setAttribute('aria-pressed', String(show));\r
\r
  syncMemoryGuides();\r
  syncMemoryKindLabelVisibility();\r
  render();\r
}\r
\r
function updateSchemaKind(show) {\r
  schemaKindVisible = show;\r
  memoryKindSchema.visible = show;\r
  memoryLinkFactSchema.visible = show && factKindVisible;\r
\r
  const btn = document.getElementById('toggleSchemaKindBtn');\r
  btn.classList.toggle('active',show);\r
  btn.setAttribute('aria-pressed', String(show));\r
\r
  syncMemoryGuides();\r
  syncMemoryKindLabelVisibility();\r
  render();\r
}\r
\r
// -----------------------------\r
// Canonical \u5199\u5165 / \u6FC0\u6D3B\u68C0\u7D22\u52A8\u753B\r
// -----------------------------\r
function setNodePulse(layer, amount) {\r
  const group =\r
    layer === 'event' ? memoryKindEvent :\r
    layer === 'fact' ? memoryKindFact :\r
    memoryKindSchema;\r
\r
  group.children.forEach((mesh,i) => {\r
    const local = Math.max(0, Math.min(1, amount - (i % 5) * 0.055));\r
    const layer = mesh.userData.memoryKind;\r
    const pulseGain = layer === 'event' ? 0.48 : (layer === 'fact' ? 0.62 : 0.70);\r
    const pulse = 1 + local * pulseGain;\r
    const selectedScale = memorySelectedScale(mesh);\r
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? Math.max(selectedScale,pulse) : pulse);\r
\r
    if (mesh.material) {\r
      const baseOpacity = mesh.userData.baseOpacity || 0.8;\r
      mesh.material.opacity = Math.min(1, baseOpacity + local * 0.20);\r
    }\r
  });\r
}\r
\r
function resetMemoryPulseVisuals() {\r
  memoryClickable.forEach(mesh => {\r
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);\r
    if (mesh.material) {\r
      mesh.material.opacity = mesh.userData.baseOpacity || mesh.material.opacity;\r
    }\r
  });\r
\r
  if (selectedMemoryData) highlightMemoryRelations(selectedMemoryData.id);\r
  else resetMemoryLinkHighlight();\r
}\r
\r
function memoryPulseFrame(now) {\r
  if (!memoryPulseMode) {\r
    memoryRAF = 0;\r
    setLightweightAnimation('memory', false);\r
    return;\r
  }\r
\r
  if (document.hidden || now - memoryLastFrame < animationFrameInterval) {\r
    memoryRAF = requestAnimationFrame(memoryPulseFrame);\r
    return;\r
  }\r
  memoryLastFrame = now;\r
\r
  const elapsed = (now - memoryPulseStart) / 1000;\r
  const duration = 4.8;\r
  const t = elapsed / duration;\r
\r
  if (t >= 1) {\r
    memoryPulseMode = null;\r
    memoryRAF = 0;\r
    resetMemoryPulseVisuals();\r
    setMemoryStatus(memoryIdleStatus());\r
    setLightweightAnimation('memory', false);\r
    render();\r
    return;\r
  }\r
\r
  const easePulse = (x) => {\r
    if (x <= 0 || x >= 1) return 0;\r
    return Math.sin(Math.PI * x);\r
  };\r
\r
  let eventT, factT, schemaT;\r
\r
  if (memoryPulseMode === 'consolidate') {\r
    eventT = easePulse((t - 0.02) / 0.34);\r
    factT = easePulse((t - 0.28) / 0.36);\r
    schemaT = easePulse((t - 0.58) / 0.38);\r
    setMemoryStatus('\u5199\u5165\uFF1A\u4E8B\u4EF6\u5019\u9009 \u2192 \u5B9E\u4F53 / \u4E8B\u5B9E\u5F52\u4E00 \u2192 \u89C4\u5219\u6821\u9A8C');\r
  } else {\r
    eventT = easePulse((t - 0.02) / 0.34);\r
    factT = easePulse((t - 0.28) / 0.36);\r
    schemaT = easePulse((t - 0.58) / 0.38);\r
    setMemoryStatus('\u68C0\u7D22\uFF1A\u67E5\u8BE2\u951A\u70B9 \u2192 \u5019\u9009\u91CD\u6392\u5E8F \u2192 \u89C4\u5219\u4E0E\u8BC1\u660E\u6269\u5C55');\r
  }\r
\r
  setNodePulse('event',eventT);\r
  setNodePulse('fact',factT);\r
  setNodePulse('schema',schemaT);\r
\r
  // \u8FDE\u7EBF\u968F\u4F20\u64AD\u9636\u6BB5\u52A0\u6DF1\r
  memoryLinkMeshes.forEach(line => {\r
    let act = 0;\r
    if (line.userData.kind === 'event-fact') act = Math.max(eventT,factT);\r
    else act = Math.max(factT,schemaT);\r
\r
    line.material.opacity = line.userData.baseOpacity + act * 0.58;\r
  });\r
\r
  render();\r
  memoryRAF = requestAnimationFrame(memoryPulseFrame);\r
}\r
\r
function startMemoryPulse(mode) {\r
  if (!memoryVisible) updateMemoryVisibility(true);\r
\r
  memoryPulseMode = mode;\r
  memoryPulseStart = performance.now();\r
  memoryLastFrame = 0;\r
  setLightweightAnimation('memory', true);\r
\r
  if (memoryRAF) cancelAnimationFrame(memoryRAF);\r
  memoryRAF = requestAnimationFrame(memoryPulseFrame);\r
}\r
\r
// ---------------------------------------------------------------------\r
// Canonical L3 \u67E5\u8BE2\u951A\u70B9 \u2192 \u4E8B\u5B9E\u7EA6\u675F \u2192 \u89C4\u5219\u8BC1\u660E \u2192 \u6587\u6863\u8BC1\u636E\r
// ---------------------------------------------------------------------\r
let memoryExampleChains = [\r
  {\r
    event:'EVT-001',\r
    fact:'FACT-SINGLE-AUTHORITY',\r
    schema:'RULE-GRAPH-AUTHORITY',\r
    evidence:'\u67B6\u6784\u51B3\u7B56\u8BB0\u5F55 / Document \u2192 Section \u2192 Chunk'\r
  },\r
  {\r
    event:'EVT-002',\r
    fact:'FACT-EVIDENCE-SEPARATE',\r
    schema:'RULE-EVIDENCE-GROUNDED',\r
    evidence:'\u9879\u76EE\u6587\u6863\u4E0E\u4EE3\u7801\u6838\u5BF9 / EvidenceLink \u2192 Chunk'\r
  },\r
  {\r
    event:'EVT-003',\r
    fact:'FACT-ACTIVATED-BOUNDED',\r
    schema:'RULE-ACTIVATION-BOUND',\r
    evidence:'\u89C4\u6A21\u98CE\u9669\u8BA8\u8BBA / \u67E5\u8BE2\u9884\u7B97\u8BB0\u5F55 \u2192 Chunk'\r
  },\r
  {\r
    event:'EVT-005',\r
    fact:'FACT-LOGICAL-SCOPE',\r
    schema:'RULE-INFERENCE-PROOF',\r
    evidence:'\u63A8\u7406\u67B6\u6784\u8BA8\u8BBA / \u89C4\u5219\u7248\u672C + \u8F93\u5165\u4E8B\u5B9E + Chunk'\r
  },\r
  {\r
    event:'EVT-010',\r
    fact:'FACT-VISUAL-FUSION',\r
    schema:'RULE-VISUAL-ENCODING',\r
    evidence:'\u524D\u7AEF\u53EF\u89C6\u5316\u51B3\u7B56 / \u9700\u6C42\u8BB0\u5F55 \u2192 Chunk'\r
  }\r
];\r
\r
let memoryExampleIndex = 0;\r
let memoryExampleActive = false;\r
\r
const chainGuideGroup = new THREE.Group();\r
memoryRoot.add(chainGuideGroup);\r
\r
function clearChainGuide() {\r
  while (chainGuideGroup.children.length) {\r
    const obj = chainGuideGroup.children.pop();\r
    if (obj.geometry) obj.geometry.dispose();\r
    if (obj.material) obj.material.dispose();\r
  }\r
}\r
\r
function chainLine(a,b,opacity=0.95,fromId='',toId='') {\r
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);\r
  const mat = new THREE.LineBasicMaterial({\r
    color:0x000000,\r
    transparent:true,\r
    opacity,\r
    depthTest:false\r
  });\r
  const l = new THREE.Line(geo,mat);\r
  l.renderOrder = 40;\r
  l.userData.fromId = fromId;\r
  l.userData.toId = toId;\r
  chainGuideGroup.add(l);\r
  return l;\r
}\r
\r
function setChainCard(eventData,factData,schemaData,evidence) {\r
  document.getElementById('chainEventText').textContent =\r
    \`\${eventData.title}\uFF08\${eventData.id}\uFF09\`;\r
  document.getElementById('chainFactText').textContent =\r
    \`\${factData.title}\uFF08\${factData.id}\uFF09\`;\r
  document.getElementById('chainSchemaText').textContent =\r
    \`\${schemaData.title}\uFF08\${schemaData.id}\uFF09\`;\r
  document.getElementById('chainEvidenceText').textContent = evidence || 'Document / Chunk \u8BC1\u636E\u5F85\u52A0\u8F7D';\r
}\r
\r
function resetExampleNodeStyles() {\r
  memoryClickable.forEach(mesh => {\r
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);\r
\r
    const layer = mesh.userData.memoryKind;\r
    mesh.material.opacity = memoryKindStyle[layer].nodeOpacity;\r
    mesh.material.color.setHex(memoryKindStyle[layer].color);\r
  });\r
\r
  memoryLinkMeshes.forEach(line => {\r
    line.material.opacity = line.userData.baseOpacity;\r
  });\r
}\r
\r
function highlightMemoryExample(index=0, focusCamera=false) {\r
  if (!memoryExampleChains.length) {\r
    memoryExampleActive = false;\r
    setMemoryStatus(canonicalSnapshot\r
      ? \`\u771F\u5B9E\u5FEB\u7167 \${canonicalSnapshot.snapshot_version} \xB7 \u5F53\u524D\u9875\u6CA1\u6709\u53EF\u7EC4\u5408\u7684\u4E09\u7C7B\u8BC1\u660E\u8282\u70B9\`\r
      : '\u6682\u65E0\u8BC1\u660E\u8DEF\u5F84');\r
    render();\r
    return;\r
  }\r
  if (!memoryVisible) updateMemoryVisibility(true);\r
  updateEventKind(true);\r
  updateFactKind(true);\r
  updateSchemaKind(true);\r
\r
  memoryExampleIndex = ((index % memoryExampleChains.length) + memoryExampleChains.length) % memoryExampleChains.length;\r
  memoryExampleActive = true;\r
\r
  const chain = memoryExampleChains[memoryExampleIndex];\r
  const eventMesh = memoryNodeById.get(chain.event);\r
  const factMesh = memoryNodeById.get(chain.fact);\r
  const schemaMesh = memoryNodeById.get(chain.schema);\r
\r
  if (!eventMesh || !factMesh || !schemaMesh) return;\r
\r
  const eventData = eventMesh.userData.memoryData;\r
  const factData = factMesh.userData.memoryData;\r
  const schemaData = schemaMesh.userData.memoryData;\r
\r
  setChainCard(eventData,factData,schemaData,chain.evidence);\r
  resetExampleNodeStyles();\r
  clearChainGuide();\r
\r
  const selectedIds = new Set([chain.event,chain.fact,chain.schema]);\r
\r
  // \u5176\u4ED6\u8282\u70B9\u6574\u4F53\u6DE1\u5316\uFF0C\u7A81\u51FA\u5F53\u524D\u6709\u9650\u8BC1\u660E\u8DEF\u5F84\u3002\r
  memoryClickable.forEach(mesh => {\r
    const id = mesh.userData.memoryData.id;\r
    const layer = mesh.userData.memoryKind;\r
\r
    if (selectedIds.has(id)) {\r
      if (layer === 'event') mesh.scale.setScalar(2.65);\r
      if (layer === 'fact') mesh.scale.setScalar(1.95);\r
      if (layer === 'schema') mesh.scale.setScalar(1.70);\r
      mesh.material.opacity = 1;\r
    } else {\r
      mesh.scale.setScalar(0.88);\r
      mesh.material.opacity = memoryKindStyle[layer].nodeOpacity * 0.28;\r
    }\r
  });\r
\r
  memoryLinkMeshes.forEach(line => {\r
    const a = line.userData.fromId;\r
    const b = line.userData.toId;\r
\r
    const eventFact =\r
      (a === chain.event && b === chain.fact) ||\r
      (a === chain.fact && b === chain.event);\r
\r
    const factRule =\r
      (a === chain.fact && b === chain.schema) ||\r
      (a === chain.schema && b === chain.fact);\r
\r
    line.material.opacity = (eventFact || factRule) ? 0.95 : 0.015;\r
  });\r
\r
  // \u5373\u4F7F\u6F14\u793A\u6570\u636E\u6CA1\u6709\u7269\u7406\u76F4\u8FDE\uFF0C\u4E5F\u8865\u753B\u5F53\u524D\u8BC1\u660E\u8DEF\u5F84\u7684\u4E24\u6BB5\u56FE\u5185\u8FDE\u63A5\u3002\r
  chainLine(eventMesh.position,factMesh.position,0.98,chain.event,chain.fact);\r
  chainLine(factMesh.position,schemaMesh.position,0.98,chain.fact,chain.schema);\r
\r
  setMemoryStatus(\r
    \`\u8BC1\u660E \${memoryExampleIndex+1}/\${memoryExampleChains.length}\uFF1A\u67E5\u8BE2\u951A\u70B9 \u2192 \u4E8B\u5B9E\u7EA6\u675F \u2192 \u89C4\u5219\u8BC1\u660E \u2192 \u6587\u6863\u8BC1\u636E\`\r
  );\r
\r
  if (focusCamera) {\r
    const groupCenter = eventMesh.position.clone()\r
      .add(factMesh.position)\r
      .add(schemaMesh.position)\r
      .multiplyScalar(1/3);\r
\r
    const worldCenter = groupCenter.clone()\r
      .add(memoryRoot.position)\r
      .multiplyScalar(1.24)\r
      .add(brainRoot.position);\r
\r
    controls.target.copy(worldCenter);\r
    camera.position.copy(worldCenter.clone().add(new THREE.Vector3(0,2.4,19)));\r
    controls.update();\r
  }\r
\r
  render();\r
}\r
\r
function clearMemoryExample() {\r
  memoryExampleActive = false;\r
  resetExampleNodeStyles();\r
  clearChainGuide();\r
  document.getElementById('chainEventText').textContent = '\u2014';\r
  document.getElementById('chainFactText').textContent = '\u2014';\r
  document.getElementById('chainSchemaText').textContent = '\u2014';\r
  document.getElementById('chainEvidenceText').textContent = '\u2014';\r
  setMemoryStatus(memoryIdleStatus());\r
  render();\r
}\r
\r
function snapshotVisualLayer(nodeKind) {\r
  const kind = String(nodeKind || 'event').toLowerCase();\r
  if (['entity', 'fact', 'attribute', 'property'].includes(kind)) return 'fact';\r
  if (['rule', 'pattern', 'schema'].includes(kind)) return 'schema';\r
  return 'event';\r
}\r
\r
function snapshotVisualNode(node, snapshot, related) {\r
  const statement = String(node.statement || '').trim();\r
  const title = statement\r
    ? statement.split(/[\u3002\uFF01\uFF1F.!?]/)[0].trim().slice(0, 96)\r
    : node.id;\r
  const evidence = (node.evidence_links || []).map((item) => item.link || item);\r
  const firstEvidence = evidence[0];\r
  const source = firstEvidence\r
    ? \`EvidenceLink \xB7 \${firstEvidence.source_locator || firstEvidence.chunk_id || 'Chunk'}\`\r
    : \`\${node.document_id || 'Canonical L3'} / \${node.section_id || 'snapshot'}\`;\r
  return {\r
    id: node.id,\r
    kind: snapshotVisualLayer(node.node_kind),\r
    title: title || node.id,\r
    summary: \`\${node.node_kind || 'event'} \xB7 \${node.semantic_type || 'canonical'} \xB7 depth \${node.depth ?? 0}\`,\r
    content: statement || \`\${node.id}\uFF08\${node.node_kind || 'event'}\uFF09\`,\r
    source,\r
    time: \`snapshot \${snapshot.snapshot_version}\`,\r
    related,\r
    score: node.score,\r
    confidence: node.confidence,\r
    status: node.status,\r
    evidence,\r
  };\r
}\r
\r
function setSnapshotChainCard(snapshot) {\r
  const nodes = snapshot.nodes || [];\r
  const anchorId = snapshot.anchor_node_id || nodes[0]?.id;\r
  const anchor = nodes.find((node) => node.id === anchorId) || nodes[0];\r
  const evidenceStep = (snapshot.proof || []).find((step) => step.kind === 'evidence');\r
  document.getElementById('chainEventText').textContent = anchor\r
    ? \`\${snapshotVisualNode(anchor, snapshot, []).title}\uFF08\${anchor.id}\uFF09\`\r
    : '\u2014';\r
  document.getElementById('chainFactText').textContent =\r
    nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'fact')\r
      ? '\u5B9E\u4F53 / \u4E8B\u5B9E\u5019\u9009\u5DF2\u5728\u771F\u5B9E\u5FEB\u7167\u4E2D\u8FD4\u56DE'\r
      : '\u5F53\u524D\u5FEB\u7167\u672A\u8FD4\u56DE\u5B9E\u4F53 / \u4E8B\u5B9E\u8282\u70B9';\r
  document.getElementById('chainSchemaText').textContent =\r
    (snapshot.rules || []).length || nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'schema')\r
      ? '\u6A21\u5F0F / \u89C4\u5219\u5019\u9009\u5DF2\u5728\u771F\u5B9E\u5FEB\u7167\u4E2D\u8FD4\u56DE'\r
      : '\u5F53\u524D\u5FEB\u7167\u672A\u8FD4\u56DE\u6A21\u5F0F / \u89C4\u5219\u8282\u70B9';\r
  document.getElementById('chainEvidenceText').textContent = evidenceStep\r
    ? \`\${evidenceStep.source_locator || evidenceStep.chunk_id || 'EvidenceLink'} \xB7 \${String(evidenceStep.quote || '').slice(0, 120)}\`\r
    : \`\${snapshot.evidence?.length || 0} \u6761 EvidenceLink \xB7 Document / Section / Chunk\`;\r
}\r
\r
function mergeCanonicalSnapshots(previous, next) {\r
  if (!previous || previous.snapshot_version !== next.snapshot_version) return next;\r
  const mergeById = (left = [], right = []) => {\r
    const merged = new Map(left.map((item) => [item.id, item]));\r
    right.forEach((item) => merged.set(item.id, item));\r
    return [...merged.values()];\r
  };\r
  const mergeEvidence = (left = [], right = []) => {\r
    const key = (item) => \`\${item.subject_type}:\${item.subject_id}:\${item.link?.id || item.id || ''}\`;
    const merged = new Map(left.map((item) => [key(item), item]));\r
    right.forEach((item) => merged.set(key(item), item));\r
    return [...merged.values()];\r
  };\r
  return {\r
    ...next,\r
    nodes: mergeById(previous.nodes, next.nodes),\r
    relations: mergeById(previous.relations, next.relations),\r
    attributes: mergeById(previous.attributes, next.attributes),\r
    rules: mergeById(previous.rules, next.rules),\r
    proof: next.proof?.length ? next.proof : previous.proof,\r
    evidence: mergeEvidence(previous.evidence, next.evidence),\r
  };\r
}\r
\r
function applyCanonicalSnapshot(snapshot) {\r
  if (!snapshot || !snapshot.read_only || !Array.isArray(snapshot.nodes)) {\r
    throw new Error('\u771F\u5B9E\u5FEB\u7167\u5951\u7EA6\u65E0\u6548');\r
  }\r
  if (!snapshot.nodes.length) {\r
    throw new Error('\u771F\u5B9E\u5FEB\u7167\u4E3A\u7A7A');\r
  }\r
\r
  const relationMap = new Map();\r
  (snapshot.relations || []).forEach((relation) => {\r
    [relation.source_node_id, relation.target_node_id].forEach((id) => {\r
      if (!id) return;\r
      if (!relationMap.has(id)) relationMap.set(id, []);\r
      const other = id === relation.source_node_id\r
        ? relation.target_node_id\r
        : relation.source_node_id;\r
      if (other && !relationMap.get(id).includes(other)) relationMap.get(id).push(other);\r
    });\r
  });\r
\r
  canonicalSnapshot = snapshot;\r
  canonicalSnapshotSource = 'api';\r
  canonicalSnapshotCursor = snapshot.continuation?.next_cursor || null;\r
  window.__canonicalSnapshot = snapshot;\r
  window.__canonicalSnapshotSource = canonicalSnapshotSource;\r
  const loadMoreButton = document.getElementById('memoryLoadMoreBtn');\r
  loadMoreButton.classList.toggle('hidden', !canonicalSnapshotCursor);\r
  loadMoreButton.disabled = false;\r
  canonicalEvents = [];\r
  canonicalFacts = [];\r
  canonicalSchemas = [];\r
  snapshot.nodes.forEach((node) => {\r
    const visual = snapshotVisualNode(node, snapshot, relationMap.get(node.id) || []);\r
    if (visual.kind === 'fact') canonicalFacts.push(visual);\r
    else if (visual.kind === 'schema') canonicalSchemas.push(visual);\r
    else canonicalEvents.push(visual);\r
  });\r
\r
  // Attributes and rules are first-class Canonical objects even when a node\r
  // page has no direct visual node for them yet.\r
  (snapshot.attributes || []).forEach((attribute) => {\r
    if (memoryNodeById.has(attribute.id)) return;\r
    canonicalFacts.push({\r
      id: attribute.id,\r
      kind: 'fact',\r
      title: attribute.attribute_type || attribute.id,\r
      summary: 'Canonical attribute fact',\r
      content: JSON.stringify(attribute.value ?? null),\r
      source: \`Canonical Attribute \xB7 \${attribute.id}\`,\r
      time: \`snapshot \${snapshot.snapshot_version}\`,\r
      related: [attribute.node_id].filter(Boolean),\r
    });\r
  });\r
  (snapshot.rules || []).forEach((rule) => {\r
    if (memoryNodeById.has(rule.id)) return;\r
    canonicalSchemas.push({\r
      id: rule.id,\r
      kind: 'schema',\r
      title: rule.name || rule.id,\r
      summary: 'Canonical rule',\r
      content: rule.description || rule.name || rule.id,\r
      source: \`Canonical Rule \xB7 \${rule.id}\`,\r
      time: \`ontology_version \${rule.ontology_version}\`,\r
      related: [],\r
    });\r
  });\r
\r
  rebuildCanonicalScene();\r
  memoryExampleChains = [];\r
  const event = canonicalEvents[0];\r
  const fact = canonicalFacts[0];\r
  const schema = canonicalSchemas[0];\r
  if (event && fact && schema) {\r
    memoryExampleChains.push({\r
      event: event.id,\r
      fact: fact.id,\r
      schema: schema.id,\r
      evidence: \`\${snapshot.evidence?.length || 0} \u6761 EvidenceLink \xB7 \${snapshot.snapshot_version}\`,\r
    });\r
    highlightMemoryExample(0, false);\r
  } else {\r
    memoryExampleActive = false;\r
    setSnapshotChainCard(snapshot);\r
  }\r
  setMemoryStatus(\`\u771F\u5B9E\u5FEB\u7167 \${snapshot.snapshot_version} \xB7 \${snapshot.nodes.length} \u8282\u70B9 / \${(snapshot.relations || []).length} \u5173\u7CFB\`);\r
  render();\r
}\r
\r
async function loadCanonicalSnapshot(cursor = null) {\r
  canonicalSnapshotLoading = true;\r
  const loadMoreButton = document.getElementById('memoryLoadMoreBtn');\r
  loadMoreButton.disabled = true;\r
  setMemoryStatus(cursor ? '\u771F\u5B9E\u5FEB\u7167\u7EED\u8F7D\u4E2D \xB7 \u4FDD\u7559\u5F53\u524D\u9875\u9762' : '\u771F\u5B9E\u5FEB\u7167\u52A0\u8F7D\u4E2D \xB7 \u4FDD\u7559\u672C\u5730\u6F14\u793A');\r
  const controller = new AbortController();\r
  const timeout = window.setTimeout(() => controller.abort(), 12000);\r
  try {\r
    const response = await fetch('/api/graph/snapshot', {\r
      method: 'POST',\r
      headers: { 'content-type': 'application/json' },\r
      body: JSON.stringify({\r
        query: 'Canonical L3 \u8BA4\u77E5\u8BB0\u5FC6',\r
        node_limit: 12,\r
        relation_limit: 48,\r
        proof_limit: 12,\r
        max_hops: 2,\r
        use_embedding: false,\r
        ...(cursor ? { cursor } : {}),\r
      }),\r
      signal: controller.signal,\r
    });\r
    if (!response.ok) throw new Error(\`snapshot HTTP \${response.status}\`);\r
    const next = await response.json();\r
    applyCanonicalSnapshot(mergeCanonicalSnapshots(cursor ? canonicalSnapshot : null, next));\r
  } catch (error) {\r
    canonicalSnapshotSource = 'demo';\r
    window.__canonicalSnapshotSource = canonicalSnapshotSource;\r
    setMemoryStatus(\`\u771F\u5B9E\u5FEB\u7167\u4E0D\u53EF\u7528 \xB7 \u4FDD\u7559\u672C\u5730\u6F14\u793A\uFF08\${String(error.message || error).slice(0, 80)}\uFF09\`);\r
    render();\r
  } finally {\r
    window.clearTimeout(timeout);\r
    canonicalSnapshotLoading = false;\r
    loadMoreButton.disabled = false;\r
  }\r
}\r
\r
// ---------------------------------------------------------------------\r
// \u6807\u7B7E\u5F15\u5BFC\u7EBF\r
// ---------------------------------------------------------------------\r
const leaderGroup = new THREE.Group();\r
scene.add(leaderGroup);\r
\r
const anchorPoints = {\r
  prefrontal: new THREE.Vector3(10.2, 7.6, 9.8).multiplyScalar(1.24).add(brainRoot.position),\r
  parietal: new THREE.Vector3(4.0, 12.4, 0.6).multiplyScalar(1.24).add(brainRoot.position),\r
  temporal: new THREE.Vector3(10.7, -0.2, 2.8).multiplyScalar(1.24).add(brainRoot.position),\r
  occipital: new THREE.Vector3(5.4, 5.9, -10.8).multiplyScalar(1.24).add(brainRoot.position),\r
  cerebellum: new THREE.Vector3(4.8, -6.6, -7.6).multiplyScalar(1.24).add(brainRoot.position),\r
  brainstem: new THREE.Vector3(0, -12.9, -5.9).multiplyScalar(1.24).add(brainRoot.position),\r
  hippocampus: new THREE.Vector3(4.7, -1.0, -1.5).multiplyScalar(1.24).add(brainRoot.position)\r
};\r
\r
const labelWorld = {\r
  tagPrefrontal: new THREE.Vector3(17, 15, 15),\r
  tagParietal: new THREE.Vector3(3, 20, 7),\r
  tagTemporal: new THREE.Vector3(19, 2, 11),\r
  tagOccipital: new THREE.Vector3(12, 12, -17),\r
  tagCerebellum: new THREE.Vector3(12, -7, -16),\r
  tagBrainstem: new THREE.Vector3(2, -18, -11),\r
  tagHippocampus: new THREE.Vector3(12, -4, 5)\r
};\r
\r
const projectedLabelPoint = new THREE.Vector3();\r
const memoryKindLabelWorld = {\r
  event: memoryCenter.clone().add(new THREE.Vector3(9.0, 5.8, 4.8)).multiplyScalar(1.24).add(brainRoot.position),\r
  fact: memoryCenter.clone().add(new THREE.Vector3(6.2, 3.8, 3.2)).multiplyScalar(1.24).add(brainRoot.position),\r
  schema: memoryCenter.clone().add(new THREE.Vector3(3.4, 2.0, 1.6)).multiplyScalar(1.24).add(brainRoot.position)\r
};\r
\r
function dashed(a,b) {\r
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);\r
  const mat = new THREE.LineDashedMaterial({\r
    color:0x000000,\r
    dashSize:0.42,\r
    gapSize:0.28,\r
    transparent:true,\r
    opacity:0.28\r
  });\r
  const l = new THREE.Line(geo,mat);\r
  l.computeLineDistances();\r
  leaderGroup.add(l);\r
}\r
\r
dashed(labelWorld.tagPrefrontal, anchorPoints.prefrontal);\r
dashed(labelWorld.tagParietal, anchorPoints.parietal);\r
dashed(labelWorld.tagTemporal, anchorPoints.temporal);\r
dashed(labelWorld.tagOccipital, anchorPoints.occipital);\r
dashed(labelWorld.tagCerebellum, anchorPoints.cerebellum);\r
dashed(labelWorld.tagBrainstem, anchorPoints.brainstem);\r
dashed(labelWorld.tagHippocampus, anchorPoints.hippocampus);\r
\r
// ---------------------------------------------------------------------\r
// \u72B6\u6001\u5207\u6362\r
// ---------------------------------------------------------------------\r
function updateRegionMode(show) {\r
  regionsVisible = show;\r
  const btn = document.getElementById('toggleRegionsBtn');\r
  btn.textContent = show ? '\u5206\u533A\u5F00' : '\u5206\u533A\u5173';\r
  btn.classList.toggle('active', show);\r
\r
  cortexMeshes.forEach(mesh => {\r
    const region = mesh.userData.region || 'parietal';\r
    if (show) {\r
      mesh.material.color.setHex(regionGray[region] || 0xd5d5d5);\r
    } else {\r
      mesh.material.color.setHex(0xd7d7d7);\r
    }\r
  });\r
\r
  cortexAnimationPairs.forEach(({proxy}) => {\r
    const region = proxy.userData.region || 'parietal';\r
    proxy.material.color.setHex(show ? (regionGray[region] || 0xd5d5d5) : 0xd7d7d7);\r
  });\r
\r
  render();\r
}\r
\r
function updateCore(show) {\r
  coreVisible = show;\r
  const btn = document.getElementById('toggleCoreBtn');\r
  btn.textContent = show ? '\u5185\u90E8\u5F00' : '\u5185\u90E8\u5173';\r
  btn.classList.toggle('active', show);\r
  coreMeshes.forEach(m => m.visible = show);\r
  refreshBrainOcclusion();\r
  render();\r
}\r
\r
function updateGrid(show) {\r
  gridVisible = show;\r
  const btn = document.getElementById('toggleGridBtn');\r
  btn.textContent = show ? '\u7F51\u683C\u5F00' : '\u7F51\u683C\u5173';\r
  btn.classList.toggle('active', show);\r
  grid.visible = show;\r
  render();\r
}\r
\r
function updateLabels(show) {\r
  labelsVisible = show;\r
  const btn = document.getElementById('toggleLabelsBtn');\r
  btn.textContent = show ? '\u6807\u7B7E\u5F00' : '\u6807\u7B7E\u5173';\r
  btn.classList.toggle('active', show);\r
\r
  [\r
    'tagPrefrontal','tagParietal','tagTemporal','tagOccipital',\r
    'tagCerebellum','tagBrainstem','tagHippocampus'\r
  ].forEach(id => document.getElementById(id).classList.toggle('hidden', !show));\r
\r
  leaderGroup.visible = show;\r
  render();\r
}\r
\r
// ---------------------------------------------------------------------\r
// \u6807\u7B7E\u6295\u5F71\r
// ---------------------------------------------------------------------\r
const axisLabels = {\r
  axisX: new THREE.Vector3(AXIS_LEN+0.6,0,0),\r
  axisY: new THREE.Vector3(0,AXIS_LEN+0.6,0),\r
  axisZ: new THREE.Vector3(0,0,AXIS_LEN+0.6)\r
};\r
\r
function place(el, point) {\r
  const p = projectedLabelPoint.copy(point).project(camera);\r
  const visible = p.z > -1 && p.z < 1;\r
\r
  if (!visible) {\r
    el.style.display = 'none';\r
    return;\r
  }\r
\r
  el.style.display = 'block';\r
  const rawX = (p.x*.5+.5) * window.innerWidth;\r
  const rawY = (-p.y*.5+.5) * window.innerHeight;\r
  placeAtScreenPoint(el, rawX, rawY);\r
}\r
\r
function placeAtScreenPoint(el, rawX, rawY) {\r
  // \u6295\u5F71\u70B9\u53EF\u80FD\u843D\u5728\u89C6\u53E3\u5916\uFF0C\u5C24\u5176\u662F\u5728\u7A84\u5C4F\u65CB\u8F6C\u65F6\uFF1B\u628A\u6807\u7B7E\u9650\u5236\u5728\u53EF\u8BFB\u533A\u57DF\u3002\r
  const margin = 6;\r
  const halfWidth = Math.max(0, el.offsetWidth / 2);\r
  const halfHeight = Math.max(0, el.offsetHeight / 2);\r
  const x = Math.max(margin + halfWidth,\r
    Math.min(window.innerWidth - margin - halfWidth, rawX));\r
  const y = Math.max(margin + halfHeight,\r
    Math.min(window.innerHeight - margin - halfHeight, rawY));\r
  el.style.left = \`\${x}px\`;\r
  el.style.top = \`\${y}px\`;\r
}\r
\r
function placeMemoryKindLabels() {\r
  const entries = [\r
    ['event', memoryGrouped ? eventKindVisible : true, document.getElementById('memoryKindEventLabel')],\r
    ['fact', memoryGrouped && factKindVisible, document.getElementById('memoryKindFactLabel')],\r
    ['schema', memoryGrouped && schemaKindVisible, document.getElementById('memoryKindSchemaLabel')]\r
  ];\r
\r
  if (memoryGrouped && window.innerWidth <= 700) {\r
    const controlsBottom = document.querySelector('.controls').getBoundingClientRect().bottom;\r
    const y = Math.min(window.innerHeight - 38, controlsBottom + 18);\r
    const xByLayer = {\r
      event: window.innerWidth / 6,\r
      fact: window.innerWidth / 2,\r
      schema: window.innerWidth * 5 / 6\r
    };\r
\r
    entries.forEach(([layer, visible, element]) => {\r
      if (!visible) return;\r
      element.style.display = 'block';\r
      placeAtScreenPoint(element, xByLayer[layer], y);\r
    });\r
    return;\r
  }\r
\r
  entries.forEach(([layer, visible, element]) => {\r
    if (visible) place(element, memoryKindLabelWorld[layer]);\r
  });\r
\r
  if (memoryGrouped && eventKindVisible) {\r
    const eventLabel = document.getElementById('memoryKindEventLabel');\r
    const eventRect = eventLabel.getBoundingClientRect();\r
    const chainRect = document.getElementById('memoryChainCard').getBoundingClientRect();\r
    const overlapsChain = eventRect.left < chainRect.right &&\r
      eventRect.right > chainRect.left &&\r
      eventRect.top < chainRect.bottom &&\r
      eventRect.bottom > chainRect.top;\r
\r
    if (overlapsChain) {\r
      placeAtScreenPoint(\r
        eventLabel,\r
        eventRect.left + eventRect.width / 2,\r
        chainRect.bottom + eventRect.height / 2 + 8\r
      );\r
    }\r
  }\r
}\r
\r
function recenterGrid() {\r
  const t = controls.target;\r
  grid.position.set(\r
    Math.round(t.x/GRID_STEP)*GRID_STEP,\r
    Math.round(t.y/GRID_STEP)*GRID_STEP,\r
    Math.round(t.z/GRID_STEP)*GRID_STEP\r
  );\r
}\r
\r
function render() {\r
  if (renderSuspended) return;\r
\r
  place(document.getElementById('axisX'), axisLabels.axisX);\r
  place(document.getElementById('axisY'), axisLabels.axisY);\r
  place(document.getElementById('axisZ'), axisLabels.axisZ);\r
\r
  if (labelsVisible) {\r
    for (const [id,p] of Object.entries(labelWorld)) {\r
      place(document.getElementById(id), p);\r
    }\r
  }\r
\r
  if (memoryVisible) {\r
    placeMemoryKindLabels();\r
  }\r
\r
  renderer.render(scene,camera);\r
  window.__brainPerformance.renderCount++;\r
}\r
\r
function requestRender() {\r
  if (renderSuspended || scheduledRender) return;\r
  scheduledRender = requestAnimationFrame(() => {\r
    scheduledRender = 0;\r
    render();\r
  });\r
}\r
\r
controls.addEventListener('change', () => {\r
  recenterGrid();\r
  requestRender();\r
});\r
\r
document.getElementById('resetBtn').addEventListener('click', () => {\r
  camera.position.set(0,2.4,44);\r
  controls.target.set(0,1.1,-0.9);\r
  grid.position.set(0,0,0);\r
  controls.update();\r
  render();\r
});\r
\r
document.getElementById('frontBtn').addEventListener('click', () => {\r
  camera.position.set(0,2.4,44);\r
  controls.target.set(0,1.1,-0.9);\r
  controls.update();\r
  render();\r
});\r
\r
document.getElementById('toggleLabelsBtn').addEventListener('click', () => {\r
  updateLabels(!labelsVisible);\r
});\r
\r
document.getElementById('toggleRegionsBtn').addEventListener('click', () => {\r
  updateRegionMode(!regionsVisible);\r
});\r
\r
document.getElementById('toggleCoreBtn').addEventListener('click', () => {\r
  updateCore(!coreVisible);\r
});\r
\r
document.getElementById('toggleGridBtn').addEventListener('click', () => {\r
  updateGrid(!gridVisible);\r
});\r
\r
document.getElementById('toggleNeuralBtn').addEventListener('click', () => {\r
  updateNeuralVisible(!neuralVisible);\r
});\r
\r
document.getElementById('spontaneousBtn').addEventListener('click', () => {\r
  setNeuralMode('spontaneous');\r
});\r
\r
document.getElementById('frontalPulseBtn').addEventListener('click', () => {\r
  setNeuralMode('prefrontal');\r
});\r
\r
document.getElementById('hippocampusPulseBtn').addEventListener('click', () => {\r
  setNeuralMode('hippocampus');\r
});\r
\r
document.getElementById('globalPulseBtn').addEventListener('click', () => {\r
  setNeuralMode('global');\r
});\r
\r
document.getElementById('toggleMemoryBtn').addEventListener('click', () => {\r
  updateMemoryVisibility(!memoryVisible);\r
});\r
\r
document.getElementById('memoryXrayBtn').addEventListener('click', () => {\r
  updateMemoryXray(!memoryXrayEnabled);\r
});\r
\r
document.getElementById('toggleObjectGroupingBtn').addEventListener('click', () => {\r
  updateObjectGrouping(!memoryGrouped);\r
});\r
\r
document.getElementById('toggleEventKindBtn').addEventListener('click', () => {\r
  updateEventKind(!eventKindVisible);\r
});\r
\r
document.getElementById('toggleFactKindBtn').addEventListener('click', () => {\r
  updateFactKind(!factKindVisible);\r
});\r
\r
document.getElementById('toggleSchemaKindBtn').addEventListener('click', () => {\r
  updateSchemaKind(!schemaKindVisible);\r
});\r
\r
document.getElementById('memoryConsolidateBtn').addEventListener('click', () => {\r
  startMemoryPulse('consolidate');\r
});\r
\r
document.getElementById('memoryRetrieveBtn').addEventListener('click', () => {\r
  startMemoryPulse('retrieve');\r
});\r
\r
document.getElementById('memoryExampleBtn').addEventListener('click', () => {\r
  highlightMemoryExample(memoryExampleIndex,true);\r
});\r
\r
document.getElementById('memoryNextExampleBtn').addEventListener('click', () => {\r
  highlightMemoryExample(memoryExampleIndex + 1,false);\r
});\r
\r
document.getElementById('memoryLoadMoreBtn').addEventListener('click', () => {\r
  if (!canonicalSnapshotLoading && canonicalSnapshotCursor) {\r
    loadCanonicalSnapshot(canonicalSnapshotCursor);\r
  }\r
});\r
\r
document.getElementById('memoryClearExampleBtn').addEventListener('click', () => {\r
  clearMemoryExample();\r
});\r
\r
window.addEventListener('resize', () => {\r
  if (scheduledRender) cancelAnimationFrame(scheduledRender);\r
  scheduledRender = requestAnimationFrame(() => {\r
    scheduledRender = 0;\r
    const w = window.innerWidth;\r
    const h = window.innerHeight;\r
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap);\r
    camera.aspect = w/h;\r
    camera.updateProjectionMatrix();\r
    if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);\r
    renderer.setSize(w,h);\r
    updateMemoryLayout();\r
    render();\r
  });\r
});\r
\r
renderSuspended = true;\r
updateLabels(true);\r
updateRegionMode(true);\r
updateCore(false);\r
updateGrid(true);\r
\r
// \u9ED8\u8BA4\u7A81\u51FA Canonical \u6FC0\u6D3B\u5B50\u56FE\uFF1A\u5173\u95ED\u5185\u90E8\u7C97\u4F53\u7D20\u5E76\u542F\u7528\u56FE\u8C31\u900F\u89C6\u3002\r
updateNeuralVisible(false);\r
setNeuralMode('spontaneous');\r
\r
updateMemoryVisibility(true);\r
updateMemoryXray(true);\r
updateObjectGrouping(false);\r
updateEventKind(true);\r
updateFactKind(true);\r
updateSchemaKind(true);\r
\r
// \u9ED8\u8BA4\u7ED9\u51FA\u4E00\u6761\u53EF\u56DE\u6E90\u7684 Canonical L3 \u8BC1\u660E\u8DEF\u5F84\u3002\r
highlightMemoryExample(0,false);\r
\r
renderSuspended = false;\r
render();\r
window.__canonicalSnapshotReady = loadCanonicalSnapshot();\r
<\/script>\r
`,d0=`
  :host { display:block; container-type:size; }
  :host([data-knowledge-brain-compact]) .hud { left:10px; top:10px; max-width:calc(100% - 20px); }
  :host([data-knowledge-brain-compact]) .hud .sub { display:none; }
  :host([data-knowledge-brain-compact]) .controls {
    left:10px; right:10px; top:48px; max-width:none;
    max-height:min(150px, 34%); overflow-y:auto;
    justify-content:flex-start; align-content:flex-start;
    gap:5px; padding:6px; border:1px solid #000;
    background:rgba(255,255,255,.92);
  }
  :host([data-knowledge-brain-compact]) .controls button { min-height:38px; padding:0 9px; }
  :host([data-knowledge-brain-compact]) #memoryChainCard {
    left:10px !important; right:10px !important; top:210px !important;
    bottom:auto !important; width:auto !important; max-height:170px; overflow:auto;
  }
  :host([data-knowledge-brain-compact]) .legend { left:10px; right:10px; bottom:42px; font-size:10px; line-height:1.45; }
  :host([data-knowledge-brain-compact]) .desktop-input-hints,
  :host([data-knowledge-brain-compact]) .desktop-node-hint,
  :host([data-knowledge-brain-compact]) .legend #neuralStatus { display:none; }
  :host([data-knowledge-brain-compact]) .mobile-input-hint { display:block; }
  :host([data-knowledge-brain-compact]) #memoryPanel {
    left:10px; right:10px; top:210px; bottom:10px; width:auto; max-height:calc(100% - 220px);
  }
  :host([data-knowledge-brain-compact]) #memoryKindLegend { left:10px; right:10px; bottom:9px; justify-content:flex-end; }
`;function Np(i){if(!i)return{ready:!1,setMode(){},dispose(){}};let e=i.shadowRoot||i.attachShadow({mode:"open"});e.innerHTML="<style>"+h0+d0+".dshBrainUi{position:absolute;inset:0}.dshBrainUi .controls,.dshBrainUi #viewport,.dshBrainUi #memoryPanel{pointer-events:auto}.eisKnowledgeBrainCanvas{display:block;width:100%;height:100%;transform:scale(1);transition:transform .65s cubic-bezier(.22,.61,.36,1);transform-origin:50% 90%}</style>"+u0;let t=e,n=globalThis.document,r=new EventTarget,a=()=>i.toggleAttribute("data-knowledge-brain-compact",i.clientWidth<=900),s=new ResizeObserver(()=>{a(),r.dispatchEvent(new Event("resize"))});s.observe(i),a();let o={get hidden(){return n.hidden},getElementById:v=>t.querySelector("#"+v),querySelector:v=>t.querySelector(v)},c=t.querySelector("#viewport"),l={high:{cortexTheta:166,cortexPhi:254,cortexCube:.228,cerebellumTheta:58,cerebellumPhi:92,cerebellumCube:.255,neuralNodes:820,activeSpheres:88,pixelRatioCap:1.25,animationFps:60,antialias:!0},balanced:{cortexTheta:136,cortexPhi:206,cortexCube:.275,cerebellumTheta:48,cerebellumPhi:74,cerebellumCube:.3,neuralNodes:560,activeSpheres:56,pixelRatioCap:1,animationFps:30,antialias:!0},low:{cortexTheta:104,cortexPhi:158,cortexCube:.35,cerebellumTheta:38,cerebellumPhi:58,cerebellumCube:.37,neuralNodes:360,activeSpheres:36,pixelRatioCap:1,animationFps:24,antialias:!1}},h=null,u=window.matchMedia("(max-width: 700px)").matches||navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4||navigator.deviceMemory&&navigator.deviceMemory<=4,d=Object.hasOwn(l,h)?h:u?"low":"balanced",p=l[d],f=window.matchMedia("(prefers-reduced-motion: reduce)").matches;window.__brainPerformance={profile:d,reducedMotion:f,cortexInstances:0,neuralInitialized:!1,neuralNodes:0,neuralEdges:0,animationProxyAvailable:!1,animationProxyActive:!1,renderCount:0};let _=new Ya;_.background=new ke(16777215),_.fog=new qa(16777215,.0105);let m=new Qt(42,c.clientWidth/c.clientHeight,.05,260);m.position.set(0,2.4,44);let g=new El({antialias:p.antialias,alpha:!1,powerPreference:"high-performance"});g.setPixelRatio(Math.min(window.devicePixelRatio||1,p.pixelRatioCap)),g.setSize(c.clientWidth,c.clientHeight),g.outputColorSpace=on,c.appendChild(g.domElement);let y=g.getContext(),x=String(y.getParameter(y.RENDERER)||""),b=/Firefox\//.test(navigator.userAgent)?null:y.getExtension("WEBGL_debug_renderer_info"),L=b?String(y.getParameter(b.UNMASKED_RENDERER_WEBGL)||x):x,I=/swiftshader|llvmpipe|software/i.test(L),B=Math.min(p.animationFps,I?12:p.animationFps,f?15:p.animationFps),G=1e3/B;Object.assign(window.__brainPerformance,{pixelRatio:g.getPixelRatio(),targetAnimationFps:B,renderer:L||"unknown",softwareRenderer:I});let F=new ps(16777215,1.1);_.add(F);let j=new li(16777215,1.08);j.position.set(13,17,18),_.add(j);let K=new li(16777215,.3);K.position.set(-15,7,11),_.add(K);let z=new li(16777215,.16);z.position.set(0,8,-18),_.add(z);let Z=new Sl(m,g.domElement);Z.enableDamping=!1,Z.enablePan=!0,Z.screenSpacePanning=!0,Z.minDistance=20,Z.maxDistance=95,Z.rotateSpeed=.7,Z.zoomSpeed=.85,Z.panSpeed=.65,Z.target.set(0,1.1,-.9),Z.mouseButtons.LEFT=Nn.ROTATE,Z.mouseButtons.MIDDLE=Nn.DOLLY,Z.mouseButtons.RIGHT=Nn.PAN;let X=2.5,Q=47;function ie(){let v=[],S=[],C=(ee,re,le,ye,He,Qe,et)=>ee.push(re,le,ye,He,Qe,et),O=ee=>Math.abs(ee%10)<.001;for(let ee=-Q;ee<=Q;ee+=X)for(let re=-Q;re<=Q;re+=X){let le=O(ee)||O(re)?S:v;C(le,-Q,ee,re,Q,ee,re),C(le,ee,-Q,re,ee,Q,re),C(le,ee,re,-Q,ee,re,Q)}let k=new Dt,q=new tt;q.setAttribute("position",new Le(v,3)),k.add(new ar(q,new Yt({color:0,transparent:!0,opacity:.04})));let $=new tt;return $.setAttribute("position",new Le(S,3)),k.add(new ar($,new Yt({color:0,transparent:!0,opacity:.095}))),k}let pe=ie();_.add(pe);let ae=31;function Se(v,S,C=.95){let O=new tt().setFromPoints([v,S]);return new Dn(O,new Yt({color:0,transparent:!0,opacity:C}))}_.add(Se(new M(-ae,0,0),new M(ae,0,0))),_.add(Se(new M(0,-ae,0),new M(0,ae,0))),_.add(Se(new M(0,0,-ae),new M(0,0,ae)));let Pe=new Bt(new Or(.035,10,10),new xn({color:0}));_.add(Pe),[[new M(1,0,0),new M(ae-1.1,0,0)],[new M(0,1,0),new M(0,ae-1.1,0)],[new M(0,0,1),new M(0,0,ae-1.1)]].forEach(([v,S])=>{_.add(new fs(v,S,1.1,0,.3,.15))});let ve=new Dt;ve.scale.set(1.24,1.24,1.24),ve.position.set(0,.6,0),_.add(ve);let Re={prefrontal:14935011,parietal:14211288,temporal:13553358,occipital:12895428,cerebellum:12171705,brainstem:11184810,hippocampus:10263708},ue=[],ge=[],me=[],De=new Set,Ve=!0,w=!0,T=!0,H=!0,D=!1,E=0;function R(v,S,C,O=()=>1){if(!I||!S.length)return;let k=4,q=Math.ceil(S.length/k),$=new Float32Array(q*3),ee=new Float32Array(q*3);for(let ye=0,He=0;ye<S.length;ye+=k,He++){let Qe=S[ye],et=O(Qe);$[He*3]=Qe.x,$[He*3+1]=Qe.y,$[He*3+2]=Qe.z,ee[He*3]=et,ee[He*3+1]=et,ee[He*3+2]=et}let re=new tt;re.setAttribute("position",new Nt($,3)),re.setAttribute("color",new Nt(ee,3));let le=new ni(re,new Dr({color:Re[v.userData.region],size:C*1.65,vertexColors:!0,transparent:!0,opacity:.34,sizeAttenuation:!0,depthWrite:!1}));le.visible=!1,le.renderOrder=3,le.userData.region=v.userData.region,ve.add(le),me.push({mesh:v,proxy:le}),window.__brainPerformance.animationProxyAvailable=!0}function U(v,S){if(!I)return;S?De.add(v):De.delete(v);let C=De.size>0;me.forEach(({mesh:O,proxy:k})=>{O.visible=!C,k.visible=C}),window.__brainPerformance.animationProxyActive=C}function P(v,S,C){return C>4.8&&S>-1.2?"prefrontal":C<-6.2&&S>-1.4?"occipital":S<2&&Math.abs(v)>4.2&&C>-5.2?"temporal":(S>4.8&&C>-5.8,"parietal")}function te(v,S,C,O,k,q){let $=W((k+1)*.5),ee=W(Math.abs(O)),re=W((q+1)*.5),le=W((-q+1)*.5),ye=W((-k+1)*.5),He=re*(.34+.66*ee)*(.5+.5*$),Qe=$*(1-re*.26)*(1-le*.2),et=ye*ee*(.72+.28*re),We=le*(.54+.46*$),St=.2*Math.sin((q*5-k*1.15+C*.13)*Math.PI)+.105*Math.sin((q*8.6+O*1.1-k*.45)*Math.PI)+.05*Math.sin((q*13.5+O*2.1)*Math.PI),Ut=.235*Math.sin((O*4.45+q*.46+C*.1)*Math.PI)+.105*Math.sin((O*7.9-q*.85+k*.33)*Math.PI)+.047*Math.sin((O*13.1+q*1.75)*Math.PI),Vt=.195*Math.sin((k*3.15+q*2.48+O*.33)*Math.PI)+.092*Math.sin((q*5.35-k*1.12-C*.16)*Math.PI)+.042*Math.sin((q*9.2+k*2.6)*Math.PI),qt=.145*Math.sin((O*2.65-q*3.85)*Math.PI)+.088*Math.sin((O*4.1-q*6.85+k*.42)*Math.PI)+.04*Math.sin((O*7.8-q*11)*Math.PI);return He*St+Qe*Ut+et*Vt+We*qt}function V(v,S,C){let O=(v-S)/C;return Math.exp(-O*O)}function W(v){return Math.min(1,Math.max(0,v))}function de(v,S,C){let O=W((C-v)/(S-v));return O*O*(3-2*O)}function fe(v,S){let C=v/S;return Math.exp(-C*C)}function he(v,S){let C=v/S;return Math.exp(-C*C)}function be(v){let S=p.cortexTheta,C=p.cortexPhi,O=p.cortexCube,k=new En(O,O,O),q={prefrontal:[],parietal:[],temporal:[],occipital:[]};for(let $=0;$<S;$++){let ee=Math.PI*$/(S-1),re=Math.sin(ee),le=Math.cos(ee),ye=Math.max(1,Math.round(C*Math.max(.036,re))),He=$%2*Math.PI/Math.max(3,ye);for(let Qe=0;Qe<ye;Qe++){let et=Math.PI*2*Qe/ye+He,We=Math.cos(et),St=Math.sin(et),Ut=9.2,Vt=12,qt=9.8,Kr=Math.max(0,-le);Ut*=1-Kr*.13,qt*=1-Kr*.1;let Sa=Math.max(0,St),Ta=Math.max(0,-St);qt*=1+Sa*.09-Ta*.05;let Ri=Math.max(0,le);Ut*=1+Ri*.03,Vt*=1+Ri*.02;let br=v*5.15,gt=br+Ut*re*We,pt=2.65+Vt*le,Et=qt*re*St,wa=.34+.23*V(pt,8.8,5.4)+.07*V(Et,0,7),nm=Math.exp(-Math.pow(Math.abs(gt)/2.1,2));gt+=v*nm*(.78+.18*V(pt,8,5));let rn=kr.clamp((gt-br)/10.5,-1,1),wn=kr.clamp((pt-2.65)/12,-1,1),an=kr.clamp(Et/10.2,-1,1),An=de(.12,.34,re),Aa=V(ee,.12*Math.PI,.12*Math.PI),Ps=V(pt,12.4,3.4),rm=V(Math.abs(gt),3,2.2),yt=te(ee,et,v,rn,wn,an)*.64*An;yt*=1-.43*Aa*Ps,yt*=1-.14*rm;let im=2+.95*Math.sin(gt*.115)-.085*(pt-5.5)+.16*Math.sin(pt*.28),zl=fe(Et-im,.56)*V(pt,6.2,5.8)*(.3+.7*Math.min(1,Math.abs(gt)/9.2));zl*=An,zl*=1-.8*Aa*Ps,yt-=zl*1.34;let am=-.35+.72*Math.sin(gt*.1+.35)-.055*(pt-5),pu=fe(Et-am,.43)*V(pt,6.6,4.7)*Math.min(1,Math.max(0,(Math.abs(gt)-2.3)/6.5));pu*=An,yt-=pu*.62;let sm=-2.6+.55*Math.sin(gt*.13-.2)+.1*(pt-7),mu=fe(Et-sm,.39)*V(pt,8.1,3.5)*Math.min(1,Math.max(0,(Math.abs(gt)-3)/5.5));mu*=An,yt-=mu*.56;let om=.85+.58*Math.sin(Et*.19)-.035*(Math.abs(gt)-7),Gl=fe(pt-om,.48)*V(Et,2,5.9)*Math.min(1,Math.max(0,(Math.abs(gt)-3.6)/6.6));Gl*=An,Gl*=1-.77*Aa,yt-=Gl*1.36;let lm=-.95+.42*Math.sin(Et*.2+.65),cm=fe(pt-lm,.36)*V(Et,1.2,5.4)*Math.min(1,Math.max(0,(Math.abs(gt)-5.1)/5.5));yt-=cm*.54;let hm=-2.9+.34*Math.sin(Et*.18-.5),um=fe(pt-hm,.32)*V(Et,.8,5)*Math.min(1,Math.max(0,(Math.abs(gt)-5.5)/5));yt-=um*.38;let Wl=fe(Et+5.75-.34*Math.sin(gt*.16),.48)*V(pt,7.3,4);Wl*=An,Wl*=1-.33*Aa*Ps,yt-=Wl*.96;let Xl=Math.min(1,Math.max(0,(Math.abs(gt)-4)/5.5)),dm=fe(pt-(7.7+.38*Math.sin(Et*.2)),.34)*V(Et,6.2,4.3)*Xl;yt-=dm*.44;let pm=fe(pt-(4.2+.32*Math.sin(Et*.22+.4)),.32)*V(Et,6.1,4.2)*Xl;yt-=pm*.39;let mm=he(pt-9.2,.65)*V(Et,6.1,4.5)*Xl;yt+=mm*.25;let fm=he(Et-(3.25+.8*Math.sin(gt*.11)),.74)*V(pt,6,5)*Math.min(1,Math.max(0,(Math.abs(gt)-2.4)/6));yt+=fm*.23;let gm=he(Et-(.75+.68*Math.sin(gt*.1+.15)),.7)*V(pt,6.3,4.8);yt+=gm*.19;let fu=W((an+.05)/.95)*W((Math.abs(rn)+.15)/1.15),ym=W((wn+.1)/.9)*(1-fu*.35),vm=W((-wn+.1)/1.05)*W((Math.abs(rn)-.1)/.9),_m=W((-an+.12)/1.05),xm=fe(Math.sin((an*8.4-wn*2.1+rn*.55)*Math.PI),.34),Em=fe(Math.sin((an*12.2+rn*1.8-wn*.7)*Math.PI),.28);yt-=fu*(xm*.12+Em*.08)*An;let Mm=fe(Math.sin((rn*7.8+an*1.2+wn*.35)*Math.PI),.32),bm=fe(Math.sin((rn*11.6-an*2.2)*Math.PI),.27);yt-=ym*(Mm*.13+bm*.075)*An;let Sm=fe(Math.sin((wn*7+an*4.4+rn*.55)*Math.PI),.32),Tm=fe(Math.sin((an*9.8-wn*3.3)*Math.PI),.27);yt-=vm*(Sm*.12+Tm*.075)*An;let wm=fe(Math.sin((rn*6-an*8.8+wn*.5)*Math.PI),.31),Am=fe(Math.sin((rn*9.2-an*13)*Math.PI),.25);yt-=_m*(wm*.12+Am*.07)*An;let Rm=.055*Math.max(0,Math.sin((rn*5.2+an*2.1-wn*.6)*Math.PI))+.04*Math.max(0,Math.sin((rn*8.8-an*3.2+wn*1.1)*Math.PI));yt+=Rm*An;let Cm=.095*Math.max(0,Math.sin((rn*11+an*5.4+wn*2.1)*Math.PI))+.065*Math.max(0,Math.sin((rn*17-an*8.2)*Math.PI));yt-=Cm*An*(.48+.72*Math.abs(rn)),Aa*Ps>.1&&yt<-.16&&(yt=-.16+(yt+.16)*.11),yt=Math.max(yt,-1.42);let gu=(gt-br)/(Ut*Ut),yu=(pt-2.65)/(Vt*Vt),vu=Et/(qt*qt),jl=Math.hypot(gu,yu,vu)||1;if(gt+=gu/jl*yt,pt+=yu/jl*yt,Et+=vu/jl*yt,pt<-5.5&&Math.abs(gt)>8&&Et>1||pt<-7.6||Et>12&&Math.abs(gt)>8.2||Math.abs(gt)<wa&&pt>-.5)continue;let Im=P(gt,pt,Et),Lm=kr.clamp((yt+1.48)/3.05,0,1);q[Im].push({x:gt,y:pt,z:Et,depth:Lm})}}Object.entries(q).forEach(([$,ee])=>{let re=new ai({color:Re[$],transparent:!0,opacity:.96}),le=new ir(k,re,ee.length),ye=new At,He=new ke(Re[$]),Qe=new ke;for(let et=0;et<ee.length;et++){let We=ee[et];ye.position.set(We.x,We.y,We.z),ye.scale.set(1,1,1),ye.updateMatrix(),le.setMatrixAt(et,ye.matrix);let St=.58+We.depth*.46;le.setColorAt(et,Qe.copy(He).multiplyScalar(St))}le.instanceMatrix.needsUpdate=!0,le.instanceColor&&(le.instanceColor.needsUpdate=!0),le.userData.region=$,le.userData.kind="cortex",ve.add(le),ue.push(le),R(le,ee,O*1.15,et=>.58+et.depth*.46),window.__brainPerformance.cortexInstances+=ee.length})}be(-1),be(1);function Ae(v){let S=p.cerebellumTheta,C=p.cerebellumPhi,O=p.cerebellumCube,k=new En(O,O,O),q=[],$=v*4,ee=-6.7,re=-6.9;for(let We=3;We<S-3;We++){let St=Math.PI*We/(S-1);for(let Ut=0;Ut<C;Ut++){let Vt=Math.PI*2*Ut/C,qt=Math.sin(St),Kr=Math.cos(St),Sa=$+4*qt*Math.cos(Vt),Ta=ee+2.65*Kr,Ri=re+3.1*qt*Math.sin(Vt),br=Math.sin(St*22+Math.sin(Vt*2.2))*.22+Math.sin(Vt*6)*.05,gt=(Sa-$)/16,pt=(Ta-ee)/(2.65*2.65),Et=(Ri-re)/(3.1*3.1),wa=Math.hypot(gt,pt,Et)||1;Sa+=gt/wa*br,Ta+=pt/wa*br,Ri+=Et/wa*br,q.push({x:Sa,y:Ta,z:Ri,depth:(br+.35)/.7})}}let le=new ai({color:Re.cerebellum,transparent:!0,opacity:.93}),ye=new ir(k,le,q.length),He=new At,Qe=new ke(Re.cerebellum),et=new ke;q.forEach((We,St)=>{He.position.set(We.x,We.y,We.z),He.updateMatrix(),ye.setMatrixAt(St,He.matrix),ye.setColorAt(St,et.copy(Qe).multiplyScalar(.81+We.depth*.16))}),ye.instanceMatrix.needsUpdate=!0,ye.instanceColor&&(ye.instanceColor.needsUpdate=!0),ye.userData.region="cerebellum",ye.userData.kind="cortex",ve.add(ye),ue.push(ye),R(ye,q,O*1.15,We=>.81+We.depth*.16),window.__brainPerformance.cortexInstances+=q.length}Ae(-1),Ae(1);function Ne(){let v=[];for(let ee=-7.3;ee>=-15.6;ee-=.3){let re=Math.abs(ee+7.3)/8.3,le=.95-re*.42+Math.sin(re*7)*.04;for(let ye=0;ye<16;ye++){let He=Math.PI*2*ye/16;v.push({x:Math.cos(He)*le*.72,y:ee,z:-5.9+Math.sin(He)*le*.52})}}let O=new En(.22,.22,.22),k=new ai({color:Re.brainstem,transparent:!0,opacity:.92}),q=new ir(O,k,v.length),$=new At;v.forEach((ee,re)=>{$.position.set(ee.x,ee.y,ee.z),$.updateMatrix(),q.setMatrixAt(re,$.matrix)}),q.instanceMatrix.needsUpdate=!0,q.userData.region="brainstem",q.userData.kind="cortex",ve.add(q),ue.push(q),R(q,v,.26,()=>.92),window.__brainPerformance.cortexInstances+=v.length}Ne();function $e(v,S,C){let O=Math.pow((v+5)/8.8,2)+Math.pow((S-2.3)/9.2,2)+Math.pow(C/8.6,2)<=1,k=Math.pow((v-5)/8.8,2)+Math.pow((S-2.3)/9.2,2)+Math.pow(C/8.6,2)<=1;return O||k}function it(){let S=[];for(let $=-13;$<=13;$+=1.3)for(let ee=-6;ee<=11;ee+=1.3)for(let re=-10;re<=10;re+=1.3)!$e($,ee,re)||Math.abs($)<.95&&ee>-.5||Math.sin($*.83)+Math.cos(ee*.71)+Math.sin(re*.77)>1.65||S.push([$,ee,re]);let C=new En(.96,.96,.96),O=new na({color:13619151,roughness:1,transparent:!0,opacity:.11,depthWrite:!1}),k=new ir(C,O,S.length),q=new At;S.forEach(($,ee)=>{q.position.set($[0],$[1],$[2]),q.updateMatrix(),k.setMatrixAt(ee,q.matrix)}),k.instanceMatrix.needsUpdate=!0,k.userData.kind="core",ve.add(k),ge.push(k)}it();function nt(v){let S=[];for(let ee=0;ee<78;ee++){let le=-1.15+ee/77*2.3,ye=v*(4.3+Math.cos(le)*1.8),He=-.8+Math.sin(le)*1.05,Qe=-1.4+Math.sin(le*1.35)*2.1;for(let et=0;et<7;et++){let We=Math.PI*2*et/7;S.push([ye+Math.cos(We)*.42,He+Math.sin(We)*.3,Qe+Math.sin(We)*.42])}}let O=new En(.28,.28,.28),k=new na({color:Re.hippocampus,roughness:1,transparent:!0,opacity:.38,depthWrite:!1}),q=new ir(O,k,S.length),$=new At;S.forEach((ee,re)=>{$.position.set(...ee),$.updateMatrix(),q.setMatrixAt(re,$.matrix)}),q.instanceMatrix.needsUpdate=!0,q.userData.kind="core",q.userData.region="hippocampus",ve.add(q),ge.push(q)}nt(-1),nt(1);let xe=new Dt;ve.add(xe);let Ie=!0,ze="spontaneous",Ct=0,we=performance.now(),rt=0,Xe=!1,tn=0,ot=[],N=[],Lt=[],Tt=[],lt=[],mn=[],qn=null,On=null,Hr=null,Vr=null,cr=null,pa=null,vi=null,Kt=null,_i=p.activeSpheres,zr=new At,Sn=[.52,.63,.72],_r=[.88,.95,1],Tn=[.6,.7,.78],xr=[.84,.92,.98],Ts=14216181;function ws(v=20260823){let S=v>>>0;return function(){S+=1831565813;let C=S;return C=Math.imul(C^C>>>15,C|1),C^=C+Math.imul(C^C>>>7,C|61),((C^C>>>14)>>>0)/4294967296}}let Gr=ws(20260823);function Tl(v,S,C){let O=Math.pow((v+4.8)/2.6,2)+Math.pow((S+1)/1.6,2)+Math.pow((C+1.5)/3.1,2)<=1,k=Math.pow((v-4.8)/2.6,2)+Math.pow((S+1)/1.6,2)+Math.pow((C+1.5)/3.1,2)<=1;return O||k?"hippocampus":C>4.5&&S>-1.4?"prefrontal":S>4.8&&C>-5.8?"parietal":C<-5.7&&S>-1.5?"occipital":S<2&&Math.abs(v)>3.6?"temporal":"deep"}function wl(){let v=p.neuralNodes,S=0;for(;ot.length<v&&S<v*40;){S++;let C=(Gr()*2-1)*12.4,O=-5.8+Gr()*16.8,k=(Gr()*2-1)*9.8;!$e(C,O,k)||Math.abs(C)<.82&&O>-.5||Math.abs(C)/12.4+Math.abs(O-2)/10.5+Math.abs(k)/9.8<.48&&Gr()<.36||(ot.push(new M(C,O,k)),N.push(Tl(C,O,k)))}for(let C=0;C<ot.length;C++)Lt.push([])}function A(){let v=ot.length,S=4.2,C=S*S,O=3,k=new Set,q=new Map,$=re=>Math.floor(re/S),ee=(re,le,ye)=>`${re}:${le}:${ye}`;for(let re=0;re<v;re++){let le=ot[re],ye=ee($(le.x),$(le.y),$(le.z));q.has(ye)||q.set(ye,[]),q.get(ye).push(re)}for(let re=0;re<v;re++){let le=[],ye=ot[re],He=$(ye.x),Qe=$(ye.y),et=$(ye.z);for(let We=-1;We<=1;We++)for(let St=-1;St<=1;St++)for(let Ut=-1;Ut<=1;Ut++){let Vt=q.get(ee(He+We,Qe+St,et+Ut));if(Vt)for(let qt of Vt){if(re===qt)continue;let Kr=ye.distanceToSquared(ot[qt]);Kr<=C&&le.push([Kr,qt])}}le.sort((We,St)=>We[0]-St[0]);for(let We=0;We<Math.min(O,le.length);We++){let St=le[We][1],Ut=Math.min(re,St),Vt=Math.max(re,St),qt=`${Ut}:${Vt}`;k.has(qt)||(k.add(qt),Tt.push([Ut,Vt]),Lt[Ut].push(Vt),Lt[Vt].push(Ut))}}}function Y(){if(Xe)return;wl(),A(),On=new tt;let v=new Float32Array(ot.length*3),S=new Float32Array(ot.length*3);for(let k=0;k<ot.length;k++){let q=ot[k];v[k*3]=q.x,v[k*3+1]=q.y,v[k*3+2]=q.z,S[k*3]=Sn[0],S[k*3+1]=Sn[1],S[k*3+2]=Sn[2]}On.setAttribute("position",new Nt(v,3)),On.setAttribute("color",new Nt(S,3)),Hr=new Dr({size:.105,vertexColors:!0,transparent:!0,opacity:.82,sizeAttenuation:!0,depthTest:!1}),Vr=new ni(On,Hr),Vr.renderOrder=20,xe.add(Vr);let C=new Float32Array(Tt.length*6),O=new Float32Array(Tt.length*6);for(let k=0;k<Tt.length;k++){let[q,$]=Tt[k],ee=ot[q],re=ot[$];C[k*6]=ee.x,C[k*6+1]=ee.y,C[k*6+2]=ee.z,C[k*6+3]=re.x,C[k*6+4]=re.y,C[k*6+5]=re.z;for(let le=0;le<6;le++)O[k*6+le]=le%3===0?Tn[0]:le%3===1?Tn[1]:Tn[2]}if(cr=new tt,cr.setAttribute("position",new Nt(C,3)),cr.setAttribute("color",new Nt(O,3)),pa=new Yt({vertexColors:!0,transparent:!0,opacity:.28,depthTest:!1}),vi=new ar(cr,pa),vi.renderOrder=18,xe.add(vi),!I){let k=new Or(.115,7,7),q=new xn({color:Ts,transparent:!0,opacity:.92,depthTest:!1});Kt=new ir(k,q,_i),Kt.count=0,Kt.renderOrder=25,xe.add(Kt)}qn=new Float32Array(ot.length),Xe=!0,se(ze),Object.assign(window.__brainPerformance,{neuralInitialized:!0,neuralNodes:ot.length,neuralEdges:Tt.length})}function ne(v){let S=[];if(v==="prefrontal")for(let C=0;C<N.length;C++)N[C]==="prefrontal"&&S.push(C);else if(v==="hippocampus")for(let C=0;C<N.length;C++)N[C]==="hippocampus"&&S.push(C);else if(v==="global"){let C=[];for(let O=0;O<ot.length;O++){let k=ot[O],q=Math.abs(k.x)+Math.abs(k.y+4)+Math.abs(k.z+4.8);C.push([q,O])}return C.sort((O,k)=>O[0]-k[0]),C.slice(0,6).map(O=>O[1])}else for(let O=0;O<3;O++){let k=Math.floor(Gr()*ot.length);S.push(k)}if(S.length||S.push(Math.floor(ot.length*.5)),S.length>18){let C=[],O=Math.max(1,Math.floor(S.length/18));for(let k=0;k<S.length&&C.length<18;k+=O)C.push(S[k]);return C}return S}function se(v){if(!Xe||!ot.length)return;lt.length=ot.length,lt.fill(1/0);let S=ne(v),C=[];for(let k of S)lt[k]=0,C.push(k);let O=0;for(;O<C.length;){let k=C[O++],q=lt[k]+1;for(let $ of Lt[k])q<lt[$]&&(lt[$]=q,C.push($))}}function J(v){ze=v,rt++,we=performance.now(),Xe&&se(v);let S={spontaneous:"\u81EA\u53D1\u8109\u51B2",prefrontal:"\u524D\u989D\u53F6\u6FC0\u6D3B",hippocampus:"\u6D77\u9A6C\u4F53\u6FC0\u6D3B",global:"\u5168\u8111\u4F20\u64AD\u6CE2"};o.getElementById("neuralStatus").textContent=`\u795E\u7ECF\u6FC0\u6D3B\uFF1A${S[v]}`,o.getElementById("spontaneousBtn").classList.toggle("active",v==="spontaneous"),o.getElementById("frontalPulseBtn").classList.toggle("active",v==="prefrontal"),o.getElementById("hippocampusPulseBtn").classList.toggle("active",v==="hippocampus"),o.getElementById("globalPulseBtn").classList.toggle("active",v==="global"),Ie&&Be()}function ce(){let v=at&&Ge,S=v&&Me;ue.forEach(O=>{v?(O.material.opacity=S?.1:.34,O.material.depthWrite=!1):(O.material.opacity=.96,O.material.depthWrite=!0),O.material.needsUpdate=!0});let C=v?S?.1:.34:.92;me.forEach(({proxy:O})=>{O.material.opacity=C}),ge.forEach(O=>{T&&(v?O.material.opacity=O.userData.region==="hippocampus"?.055:.008:O.material.opacity=O.userData.region==="hippocampus"?.38:.11,O.material.depthWrite=!1,O.material.needsUpdate=!0)})}function Ee(v){ce()}function Te(v){if(!Xe)return;let S=(v-we)/1e3,C=ze==="global"?4.8:3.8,O=S%C;if(ze==="spontaneous"){let le=Math.floor(S/C);le!==rt&&(rt=le,se("spontaneous"))}let k=On.getAttribute("color"),q=cr.getAttribute("color"),$=qn,ee=ze==="global"?.115:.09,re=ze==="global"?.38:.3;for(let le=0;le<$.length;le++){let ye=lt[le];if(!Number.isFinite(ye)){$[le]=0;continue}let He=ye*ee,Qe=(O-He)/re,et=Math.exp(-Qe*Qe),We=(O-He-.44)/.72;et=Math.max(et,Math.exp(-We*We)*.22),$[le]=Math.min(1,et)}for(let le=0;le<$.length;le++){let ye=$[le];k.array[le*3]=Sn[0]+ye*(_r[0]-Sn[0]),k.array[le*3+1]=Sn[1]+ye*(_r[1]-Sn[1]),k.array[le*3+2]=Sn[2]+ye*(_r[2]-Sn[2])}k.needsUpdate=!0;for(let le=0;le<Tt.length;le++){let[ye,He]=Tt[le],Qe=Math.max($[ye],$[He])*.92+Math.min($[ye],$[He])*.08,et=Tn[0]+Qe*(xr[0]-Tn[0]),We=Tn[1]+Qe*(xr[1]-Tn[1]),St=Tn[2]+Qe*(xr[2]-Tn[2]);q.array[le*6]=et,q.array[le*6+1]=We,q.array[le*6+2]=St,q.array[le*6+3]=et,q.array[le*6+4]=We,q.array[le*6+5]=St}if(q.needsUpdate=!0,Kt){mn.length=0;for(let ye=0;ye<$.length;ye++)$[ye]>.48&&mn.push([$[ye],ye]);mn.sort((ye,He)=>He[0]-ye[0]);let le=Math.min(_i,mn.length);Kt.count=le;for(let ye=0;ye<le;ye++){let[He,Qe]=mn[ye],et=ot[Qe],We=.72+He*1.65;zr.position.copy(et),zr.scale.setScalar(We),zr.updateMatrix(),Kt.setMatrixAt(ye,zr.matrix)}Kt.instanceMatrix.needsUpdate=!0}}function Ce(v){if(!Ie){Ct=0;return}Ct=requestAnimationFrame(Ce),!(n.hidden||v-tn<G)&&(tn=v,Te(v),ft())}function Be(){Ie&&(Ct||(tn=0,Ct=requestAnimationFrame(Ce)))}function Fe(){Ct&&(cancelAnimationFrame(Ct),Ct=0)}function Oe(v){Ie=v,xe.visible=v;let S=o.getElementById("toggleNeuralBtn");S.textContent=v?"\u795E\u7ECF\u7F51\u7EDC\u5F00":"\u795E\u7ECF\u7F51\u7EDC\u5173",S.classList.toggle("active",v),Ee(v),v?(Y(),U("neural",!0),we=performance.now(),se(ze),Be()):(Fe(),U("neural",!1),ft())}let Ue=new Dt;ve.add(Ue);let ut=new Dt,_t=new Dt,bt=new Dt,dt=new Dt,je=new Dt,xt=new Dt;Ue.add(xt),Ue.add(dt),Ue.add(je),Ue.add(ut),Ue.add(_t),Ue.add(bt);let at=!0,Ge=!0,Me=!1,Ft=!0,Bn=!0,Fn=!0,It=null,kt=null,Ht=0,ln=null,xi=0,Yn=0,kn=null,Wr="demo",Ei=null,Ze=!1,Kn=[],mt=new Map,Zt=[],Xr=[],Mi=new M,nn=[{id:"EVT-001",kind:"event",title:"\u7EDF\u4E00\u4E3A Canonical L3",summary:"\u5220\u9664\u72EC\u7ACB\u77E5\u8BC6\u5C42\u7EA7\uFF0C\u628A\u53EF\u63A8\u7406\u5BF9\u8C61\u5E76\u5165\u552F\u4E00\u6743\u5A01\u56FE\u3002",content:"\u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u6A21\u5F0F\u3001\u89C4\u5219\u548C\u6D3E\u751F\u4E8B\u5B9E\u7EDF\u4E00\u8FDB\u5165 Canonical L3\uFF1B\u5BF9\u8C61\u7C7B\u578B\u4FDD\u7559\uFF0C\u4F46\u4E0D\u518D\u62E5\u6709\u5F7C\u6B64\u5272\u88C2\u7684\u5B58\u50A8\u5C42\u7EA7\u3002",source:"\u67B6\u6784\u51B3\u7B56\u8BB0\u5F55",time:"2026-08-25",related:["ENT-CANONICAL-L3","FACT-SINGLE-AUTHORITY","RULE-GRAPH-AUTHORITY"]},{id:"EVT-002",kind:"event",title:"\u786E\u8BA4\u72EC\u7ACB\u8BC1\u636E\u901A\u9053",summary:"DocumentVector \u4E0E BM25 \u7EE7\u7EED\u4FDD\u5B58\u4E8B\u5B9E\u8BC1\u636E\u548C\u6587\u672C\u5B9A\u4F4D\u80FD\u529B\u3002",content:"Document\u3001Section\u3001Chunk\u3001DocumentVector \u548C BM25 \u4E0D\u5E76\u5165\u56FE\u8282\u70B9\u5C42\u7EA7\uFF1B\u5B83\u4EEC\u901A\u8FC7 EvidenceLink \u4E3A\u56FE\u4E2D\u65AD\u8A00\u548C\u8BC1\u660E\u63D0\u4F9B\u53EF\u6838\u9A8C\u539F\u6587\u3002",source:"\u9879\u76EE\u6587\u6863\u4E0E\u4EE3\u7801\u6838\u5BF9",time:"2026-08-25",related:["ENT-DOCUMENT-VECTOR","FACT-EVIDENCE-SEPARATE","RULE-EVIDENCE-GROUNDED"]},{id:"EVT-003",kind:"event",title:"\u8BC4\u4F30\u5343\u4E07\u7EA7\u56FE\u89C4\u6A21",summary:"\u5B8C\u6574\u56FE\u4E0D\u80FD\u5728\u5355\u6B21\u67E5\u8BE2\u6216\u6D4F\u89C8\u5668\u753B\u9762\u4E2D\u6574\u4F53\u52A0\u8F7D\u3002",content:"\u5F53\u8282\u70B9\u8FBE\u5230\u5343\u4E07\u7EA7\u65F6\uFF0C\u67E5\u8BE2\u5148\u901A\u8FC7\u7ED3\u6784\u8FC7\u6EE4\u3001\u5411\u91CF\u5019\u9009\u548C\u91CD\u6392\u5E8F\u5F62\u6210\u6709\u9650\u6FC0\u6D3B\u5B50\u56FE\uFF0C\u518D\u5728\u903B\u8F91\u5B8C\u6574\u56FE\u8303\u56F4\u5185\u6269\u5C55\u5FC5\u8981\u8BC1\u660E\u8DEF\u5F84\u3002",source:"\u89C4\u6A21\u98CE\u9669\u8BA8\u8BBA",time:"2026-08-25",related:["FACT-LOGICAL-SCOPE","FACT-ACTIVATED-BOUNDED","RULE-ACTIVATION-BOUND"]},{id:"EVT-004",kind:"event",title:"\u5EFA\u7ACB\u8FC1\u79FB\u6062\u590D\u70B9",summary:"\u5728 schema \u8FC1\u79FB\u524D\u521B\u5EFA Git \u6807\u7B7E\u548C\u9879\u76EE\u5916\u5B8C\u6574\u5907\u4EFD\u3002",content:"\u8FC1\u79FB\u5FC5\u987B\u4FDD\u7559\u7A33\u5B9A\u8282\u70B9 ID\u3001\u5173\u7CFB ID\u3001EvidenceLink subject ID \u4E0E chunk ID\uFF0C\u5E76\u5148\u5728\u72B6\u6001\u526F\u672C\u4E0A\u9A8C\u8BC1\u5B8C\u6574\u6027\u3002",source:"\u8FC1\u79FB\u6267\u884C\u8BB0\u5F55",time:"2026-08-24",related:["FACT-STABLE-MIGRATION","ENT-CANONICAL-L3","RULE-GRAPH-AUTHORITY"]},{id:"EVT-005",kind:"event",title:"\u5B9A\u4E49\u5B8C\u6574\u56FE\u63A8\u7406\u8FB9\u754C",summary:"\u5B8C\u6574\u56FE\u662F\u903B\u8F91\u53EF\u8FBE\u8303\u56F4\uFF0C\u4E0D\u662F\u6BCF\u6B21\u67E5\u8BE2\u7684\u7269\u7406\u52A0\u8F7D\u8303\u56F4\u3002",content:"\u63A8\u7406\u5668\u53EF\u4EE5\u6309\u89C4\u5219\u548C\u5173\u7CFB\u7EE7\u7EED\u6269\u5C55\u5C1A\u672A\u52A0\u8F7D\u7684\u8282\u70B9\uFF0C\u76F4\u5230\u547D\u4E2D\u76EE\u6807\u3001\u9884\u7B97\u6216\u505C\u6B62\u6761\u4EF6\uFF1B\u8FD4\u56DE\u7ED3\u679C\u540C\u65F6\u643A\u5E26\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\u3002",source:"\u63A8\u7406\u67B6\u6784\u8BA8\u8BBA",time:"2026-08-25",related:["FACT-LOGICAL-SCOPE","ENT-CANONICAL-RULE","RULE-INFERENCE-PROOF"]},{id:"EVT-006",kind:"event",title:"\u5F15\u5165\u6FC0\u6D3B\u5B50\u56FE",summary:"\u8FD0\u884C\u65F6\u53EA\u4FDD\u7559\u5F53\u524D\u95EE\u9898\u76F8\u5173\u7684\u5019\u9009\u8282\u70B9\u3001\u5173\u7CFB\u548C\u8BC1\u660E\u8DEF\u5F84\u3002",content:"Activated Subgraph\u3001ANN\u3001Reranker \u4E0E Cache \u90FD\u662F\u53EF\u91CD\u5EFA\u8FD0\u884C\u65F6\u6D3E\u751F\u80FD\u529B\uFF0C\u4E0D\u662F\u65B0\u7684\u77E5\u8BC6\u5C42\uFF0C\u4E5F\u4E0D\u62E5\u6709\u6743\u5A01\u4E8B\u5B9E\u3002",source:"\u67E5\u8BE2\u6267\u884C\u8BBE\u8BA1",time:"2026-08-25",related:["FACT-ACTIVATED-BOUNDED","FACT-ANN-RERANK","RULE-ACTIVATION-BOUND"]},{id:"EVT-007",kind:"event",title:"\u5411\u91CF\u5316\u56FE\u5BF9\u8C61",summary:"\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u548C\u89C4\u5219\u53EF\u751F\u6210\u5411\u91CF\uFF0C\u7528\u4E8E\u53EC\u56DE\u4E0E\u91CD\u6392\u5E8F\u3002",content:"\u5411\u91CF\u7D22\u5F15\u4FDD\u5B58 Canonical ID \u4E0E\u7248\u672C\u6307\u9488\uFF1B\u5411\u91CF\u662F\u68C0\u7D22\u6295\u5F71\uFF0C\u4E0D\u66FF\u4EE3\u56FE\u4E2D\u7684\u5173\u7CFB\u7EA6\u675F\u3001\u89C4\u5219\u8BED\u4E49\u6216\u8BC1\u636E\u94FE\u3002",source:"\u68C0\u7D22\u67B6\u6784\u8BA8\u8BBA",time:"2026-08-25",related:["ENT-GRAPH-VECTOR-INDEX","FACT-ANN-RERANK","RULE-ACTIVATION-BOUND"]},{id:"EVT-008",kind:"event",title:"\u4FDD\u7559\u4E8B\u5B9E\u8BC1\u636E\u56DE\u6E90",summary:"\u4EFB\u4F55\u56DE\u7B54\u548C\u6D3E\u751F\u4E8B\u5B9E\u90FD\u5E94\u80FD\u5B9A\u4F4D\u5230\u652F\u6301\u5B83\u7684\u6587\u6863\u7247\u6BB5\u3002",content:"\u56FE\u5173\u7CFB\u8D1F\u8D23\u8868\u8FBE\u77E5\u8BC6\u7ED3\u6784\uFF0CEvidenceLink \u8D1F\u8D23\u8FDE\u63A5\u5177\u4F53 Chunk\uFF1B\u89C4\u5219\u8BC1\u660E\u4E0D\u80FD\u628A\u5411\u91CF\u76F8\u4F3C\u5EA6\u4F2A\u88C5\u6210\u4E8B\u5B9E\u8BC1\u636E\u3002",source:"\u8BC1\u636E\u6A21\u578B\u8BA8\u8BBA",time:"2026-08-25",related:["FACT-EVIDENCE-SEPARATE","FACT-PROVENANCE","RULE-EVIDENCE-GROUNDED"]},{id:"EVT-009",kind:"event",title:"\u89C4\u5219\u5E76\u5165\u6743\u5A01\u56FE",summary:"\u89C4\u5219\u3001\u6A21\u5F0F\u548C\u6D3E\u751F\u4E8B\u5B9E\u4E0E\u5B9E\u4F53\u5173\u7CFB\u5171\u4EAB\u7248\u672C\u5316\u6CBB\u7406\u3002",content:"\u89C4\u5219\u8282\u70B9\u63CF\u8FF0\u5339\u914D\u524D\u63D0\u4E0E\u7ED3\u8BBA\uFF0C\u6D3E\u751F\u4E8B\u5B9E\u8BB0\u5F55\u89C4\u5219\u7248\u672C\u3001\u8F93\u5165\u4E8B\u5B9E\u3001\u8BC1\u636E\u6765\u6E90\u548C\u751F\u6210\u65F6\u95F4\uFF0C\u652F\u6301\u5BA1\u8BA1\u4E0E\u5931\u6548\u91CD\u7B97\u3002",source:"Canonical L3 \u6A21\u578B\u8BBE\u8BA1",time:"2026-08-25",related:["ENT-CANONICAL-RULE","FACT-SINGLE-AUTHORITY","RULE-INFERENCE-PROOF"]},{id:"EVT-010",kind:"event",title:"\u4E09\u7EF4\u89C6\u56FE\u6539\u4E3A\u9ED8\u8BA4\u878D\u5408",summary:"\u4E0D\u540C\u5BF9\u8C61\u5728\u540C\u4E00\u56FE\u7A7A\u95F4\u6DF7\u5408\u5206\u5E03\uFF0C\u7070\u9636\u548C\u5F62\u72B6\u53EA\u7F16\u7801\u7C7B\u578B\u3002",content:"\u9ED8\u8BA4\u753B\u9762\u5C55\u793A\u4E00\u4E2A Canonical L3 \u6FC0\u6D3B\u5B50\u56FE\u8FB9\u754C\uFF1B\u5BF9\u8C61\u5206\u7EC4\u53EA\u662F\u4E34\u65F6\u89C2\u5BDF\u6A21\u5F0F\uFF0C\u4E0D\u80FD\u88AB\u7406\u89E3\u4E3A\u72EC\u7ACB\u77E5\u8BC6\u5C42\u3002",source:"\u524D\u7AEF\u53EF\u89C6\u5316\u51B3\u7B56",time:"2026-08-25",related:["FACT-VISUAL-FUSION","ENT-CANONICAL-L3","RULE-VISUAL-ENCODING"]},{id:"EVT-011",kind:"event",title:"\u9650\u5B9A\u9ED1\u767D\u7070\u89C6\u89C9\u8BED\u8A00",summary:"\u6240\u6709\u8282\u70B9\u3001\u5173\u7CFB\u3001\u72B6\u6001\u548C\u6FC0\u6D3B\u5F3A\u5EA6\u53EA\u4F7F\u7528\u7070\u9636\u3002",content:"\u77F3\u58A8\u9ED1\u5FAE\u70B9\u8868\u793A\u4E8B\u4EF6\uFF0C\u4E2D\u7070\u7EBF\u6846\u8868\u793A\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\uFF0C\u6D45\u7070\u591A\u9762\u4F53\u8868\u793A\u6A21\u5F0F\u4E0E\u89C4\u5219\uFF1B\u6FC0\u6D3B\u901A\u8FC7\u660E\u6697\u3001\u5C3A\u5BF8\u548C\u7EBF\u5BBD\u8868\u8FBE\u3002",source:"\u754C\u9762\u7EA6\u675F",time:"2026-08-25",related:["FACT-VISUAL-FUSION","RULE-VISUAL-ENCODING"]},{id:"EVT-012",kind:"event",title:"\u9650\u5236\u6D4F\u89C8\u5668\u6E32\u67D3\u9884\u7B97",summary:"3D \u9875\u9762\u53EA\u6E32\u67D3\u53EF\u4EA4\u4E92\u7684\u6709\u9650\u8282\u70B9\u96C6\u5408\u3002",content:"\u540E\u7AEF\u5206\u9875\u5FEB\u7167\u3001LOD\u3001\u6279\u91CF\u51E0\u4F55\u548C\u6309\u9700\u5173\u7CFB\u5C55\u5F00\u5171\u540C\u63A7\u5236\u6E32\u67D3\u6210\u672C\uFF1B\u5B8C\u6574\u56FE\u89C4\u6A21\u4E0D\u76F4\u63A5\u51B3\u5B9A\u5F53\u524D\u5E27\u8282\u70B9\u6570\u3002",source:"\u524D\u7AEF\u6027\u80FD\u4F18\u5316",time:"2026-08-25",related:["FACT-ACTIVATED-BOUNDED","FACT-ANN-RERANK","RULE-ACTIVATION-BOUND"]}],ct=[{id:"ENT-CANONICAL-L3",kind:"entity",title:"Canonical L3",summary:"\u552F\u4E00\u6743\u5A01\u3001\u7248\u672C\u5316\u3001\u53EF\u5BA1\u8BA1\u7684\u5B8C\u6574\u77E5\u8BC6\u56FE\u3002",content:"\u627F\u8F7D TBox\u3001ABox\u3001\u4E8B\u4EF6\u3001\u5B9E\u4F53\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u3001\u89C4\u5219\u548C\u6D3E\u751F\u4E8B\u5B9E\uFF1B\u6240\u6709\u5BF9\u8C61\u4F7F\u7528\u7A33\u5B9A ID\uFF0C\u5E76\u63A5\u53D7\u7EDF\u4E00\u5B8C\u6574\u6027\u7EA6\u675F\u3002",source:"Canonical \u6570\u636E\u6A21\u578B",time:"schema 5",related:["EVT-001","EVT-004","EVT-010","FACT-SINGLE-AUTHORITY","RULE-GRAPH-AUTHORITY"]},{id:"ENT-DOCUMENT-VECTOR",kind:"entity",title:"DocumentVector / BM25",summary:"\u9762\u5411\u539F\u6587\u7247\u6BB5\u7684\u5411\u91CF\u548C\u8BCD\u6CD5\u8BC1\u636E\u7D22\u5F15\u3002",content:"\u4FDD\u5B58\u6587\u6863\u7EA7\u4E0E Chunk \u7EA7\u68C0\u7D22\u6295\u5F71\uFF0C\u547D\u4E2D\u540E\u8FD4\u56DE\u539F\u6587\u5B9A\u4F4D\uFF1B\u5B83\u4E0D\u627F\u62C5\u6743\u5A01\u56FE\u5173\u7CFB\u6216\u5B8C\u6574\u56FE\u63A8\u7406\u3002",source:"\u72EC\u7ACB\u8BC1\u636E\u901A\u9053",time:"\u6301\u7EED\u66F4\u65B0",related:["EVT-002","FACT-EVIDENCE-SEPARATE","FACT-PROVENANCE","RULE-EVIDENCE-GROUNDED"]},{id:"ENT-GRAPH-VECTOR-INDEX",kind:"entity",title:"\u56FE\u5BF9\u8C61\u5411\u91CF\u7D22\u5F15",summary:"Canonical \u8282\u70B9\u3001\u5173\u7CFB\u3001\u5C5E\u6027\u548C\u89C4\u5219\u7684\u53EF\u91CD\u5EFA\u68C0\u7D22\u6295\u5F71\u3002",content:"\u7D22\u5F15\u9879\u6307\u5411 Canonical ID \u548C ontology_version\uFF1BANN \u53EA\u8D1F\u8D23\u5019\u9009\u53EC\u56DE\uFF0C\u6700\u7EC8\u7ED3\u679C\u8FD8\u8981\u7ECF\u8FC7\u7ED3\u6784\u7EA6\u675F\u3001\u91CD\u6392\u5E8F\u548C\u8BC1\u660E\u6821\u9A8C\u3002",source:"\u8FD0\u884C\u65F6\u6D3E\u751F\u7D22\u5F15",time:"\u53EF\u91CD\u5EFA",related:["EVT-007","FACT-ANN-RERANK","RULE-ACTIVATION-BOUND"]},{id:"ENT-CANONICAL-RULE",kind:"entity",title:"Canonical Rule",summary:"\u5305\u542B\u524D\u63D0\u3001\u7EA6\u675F\u3001\u7ED3\u8BBA\u548C\u7248\u672C\u4FE1\u606F\u7684\u56FE\u5185\u89C4\u5219\u5BF9\u8C61\u3002",content:"\u89C4\u5219\u5339\u914D\u4EA7\u751F\u6D3E\u751F\u4E8B\u5B9E\u65F6\u8BB0\u5F55\u8F93\u5165\u8282\u70B9\u3001\u5173\u7CFB\u3001\u8BC1\u636E\u4E0E\u89C4\u5219\u7248\u672C\uFF0C\u4ECE\u800C\u5141\u8BB8\u89E3\u91CA\u3001\u64A4\u9500\u548C\u91CD\u65B0\u8BA1\u7B97\u3002",source:"Canonical L3 \u89C4\u5219\u6A21\u578B",time:"\u7248\u672C\u5316",related:["EVT-005","EVT-009","RULE-INFERENCE-PROOF"]},{id:"FACT-SINGLE-AUTHORITY",kind:"fact",title:"\u6743\u5A01\u4E8B\u5B9E\u53EA\u6709\u4E00\u4E2A\u5F52\u5C5E",summary:"\u77E5\u8BC6\u771F\u503C\u53EA\u7531 Canonical L3 \u6CBB\u7406\u3002",content:"\u7F13\u5B58\u3001\u5411\u91CF\u7D22\u5F15\u548C\u6FC0\u6D3B\u5B50\u56FE\u53EF\u4EE5\u4E22\u5F03\u540E\u91CD\u5EFA\uFF0C\u4E0D\u80FD\u53CD\u5411\u8986\u76D6 Canonical L3 \u4E2D\u7684\u4E8B\u5B9E\u548C\u89C4\u5219\u3002",source:"\u67B6\u6784\u7EA6\u675F",time:"\u6709\u6548",related:["EVT-001","EVT-009","ENT-CANONICAL-L3","RULE-GRAPH-AUTHORITY"]},{id:"FACT-EVIDENCE-SEPARATE",kind:"fact",title:"\u8BC1\u636E\u68C0\u7D22\u4E0E\u56FE\u63A8\u7406\u89E3\u8026",summary:"\u56FE\u56DE\u7B54\u201C\u5173\u7CFB\u662F\u4EC0\u4E48\u201D\uFF0C\u6587\u6863\u901A\u9053\u56DE\u7B54\u201C\u539F\u6587\u5728\u54EA\u91CC\u201D\u3002",content:"\u4E24\u6761\u901A\u9053\u5728\u67E5\u8BE2\u89C4\u5212\u9636\u6BB5\u534F\u540C\uFF0C\u5728 EvidenceLink \u548C\u8BC1\u660E\u7ED3\u679C\u5904\u6C47\u5408\uFF1B\u4EFB\u4E00\u901A\u9053\u90FD\u4E0D\u80FD\u5192\u5145\u53E6\u4E00\u901A\u9053\u3002",source:"\u8BC1\u636E\u67B6\u6784\u7EA6\u675F",time:"\u6709\u6548",related:["EVT-002","EVT-008","ENT-DOCUMENT-VECTOR","RULE-EVIDENCE-GROUNDED"]},{id:"FACT-LOGICAL-SCOPE",kind:"fact",title:"\u5B8C\u6574\u56FE\u662F\u903B\u8F91\u63A8\u7406\u8303\u56F4",summary:"\u63A8\u7406\u53EF\u6309\u9700\u8BBF\u95EE\u5B8C\u6574\u56FE\uFF0C\u4F46\u65E0\u9700\u4E00\u6B21\u88C5\u5165\u5185\u5B58\u3002",content:"\u5173\u7CFB\u6269\u5C55\u7531\u67E5\u8BE2\u76EE\u6807\u3001\u89C4\u5219\u524D\u63D0\u3001\u65F6\u95F4\u8303\u56F4\u3001\u6743\u9650\u4E0E\u6210\u672C\u9884\u7B97\u7EA6\u675F\uFF1B\u903B\u8F91\u5B8C\u6574\u6027\u548C\u7269\u7406\u6267\u884C\u89C4\u6A21\u662F\u4E24\u4E2A\u6982\u5FF5\u3002",source:"\u63A8\u7406\u6267\u884C\u7EA6\u675F",time:"\u6709\u6548",related:["EVT-003","EVT-005","RULE-INFERENCE-PROOF"]},{id:"FACT-ACTIVATED-BOUNDED",kind:"fact",title:"\u6FC0\u6D3B\u5B50\u56FE\u5FC5\u987B\u6709\u754C",summary:"\u5355\u6B21\u67E5\u8BE2\u548C\u5355\u5E27\u53EF\u89C6\u5316\u53EA\u4F7F\u7528\u6709\u9650\u5019\u9009\u96C6\u5408\u3002",content:"\u5019\u9009\u6570\u91CF\u3001\u6269\u5C55\u8DF3\u6570\u3001\u8BC1\u660E\u6DF1\u5EA6\u3001\u8D85\u65F6\u548C\u6E32\u67D3\u8282\u70B9\u6570\u90FD\u5FC5\u987B\u8BBE\u7F6E\u9884\u7B97\uFF0C\u5E76\u5728\u9700\u8981\u65F6\u7EE7\u7EED\u5206\u9875\u6269\u5C55\u3002",source:"\u8FD0\u884C\u65F6\u9884\u7B97",time:"\u6BCF\u6B21\u67E5\u8BE2",related:["EVT-003","EVT-006","EVT-012","RULE-ACTIVATION-BOUND"]},{id:"FACT-ANN-RERANK",kind:"fact",title:"ANN \u53EC\u56DE\u540E\u5FC5\u987B\u91CD\u6392\u5E8F",summary:"\u5411\u91CF\u76F8\u4F3C\u5EA6\u53EA\u8D1F\u8D23\u7F29\u5C0F\u5019\u9009\uFF0C\u4E0D\u76F4\u63A5\u7B49\u4E8E\u4E8B\u5B9E\u76F8\u5173\u6027\u3002",content:"Reranker \u7EFC\u5408\u8BED\u4E49\u76F8\u4F3C\u3001\u5173\u7CFB\u8DEF\u5F84\u3001\u89C4\u5219\u53EF\u6EE1\u8DB3\u6027\u3001\u65F6\u95F4\u4E0E\u8BC1\u636E\u8D28\u91CF\uFF0C\u4EA7\u751F\u53EF\u89E3\u91CA\u7684\u6FC0\u6D3B\u4F18\u5148\u7EA7\u3002",source:"\u68C0\u7D22\u6267\u884C\u7B56\u7565",time:"\u6BCF\u6B21\u67E5\u8BE2",related:["EVT-006","EVT-007","EVT-012","ENT-GRAPH-VECTOR-INDEX","RULE-ACTIVATION-BOUND"]},{id:"FACT-PROVENANCE",kind:"fact",title:"\u8BC1\u660E\u5FC5\u987B\u643A\u5E26\u6765\u6E90",summary:"\u7ED3\u8BBA\u53EF\u56DE\u6EAF\u5230 Document\u3001Chunk\u3001\u8F93\u5165\u4E8B\u5B9E\u548C\u89C4\u5219\u7248\u672C\u3002",content:"\u76F4\u63A5\u4E8B\u5B9E\u5F15\u7528 EvidenceLink\uFF1B\u6D3E\u751F\u4E8B\u5B9E\u8FD8\u8981\u4FDD\u5B58\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\uFF0C\u907F\u514D\u53EA\u8FD4\u56DE\u4E0D\u53EF\u9A8C\u8BC1\u7684\u56FE\u7ED3\u8BBA\u3002",source:"\u5BA1\u8BA1\u7EA6\u675F",time:"\u6709\u6548",related:["EVT-008","ENT-DOCUMENT-VECTOR","RULE-EVIDENCE-GROUNDED","RULE-INFERENCE-PROOF"]},{id:"FACT-STABLE-MIGRATION",kind:"fact",title:"\u8FC1\u79FB\u4FDD\u6301\u7A33\u5B9A\u6807\u8BC6",summary:"schema \u53D8\u5316\u4E0D\u6539\u5199\u65E2\u6709\u5BF9\u8C61\u548C\u8BC1\u636E\u5F15\u7528\u7684\u8EAB\u4EFD\u3002",content:"\u8FC1\u79FB\u9A8C\u8BC1\u6BD4\u8F83\u6240\u6709\u7A33\u5B9A ID \u96C6\u5408\u3001\u5BF9\u8C61\u6570\u91CF\u3001EvidenceLink subject/chunk \u6307\u9488\u4E0E\u5B8C\u6574\u6027\u7ED3\u679C\uFF0C\u518D\u5141\u8BB8\u66FF\u6362\u6B63\u5F0F\u72B6\u6001\u3002",source:"\u8FC1\u79FB\u5B89\u5168\u7EA6\u675F",time:"schema 4 \u2192 5",related:["EVT-004","ENT-CANONICAL-L3","RULE-GRAPH-AUTHORITY"]},{id:"FACT-VISUAL-FUSION",kind:"fact",title:"\u5BF9\u8C61\u7C7B\u578B\u4E0D\u662F\u77E5\u8BC6\u5C42\u7EA7",summary:"\u4E8B\u4EF6\u3001\u4E8B\u5B9E\u4E0E\u89C4\u5219\u5728\u540C\u4E00\u4E2A Canonical L3 \u7A7A\u95F4\u5171\u540C\u663E\u793A\u3002",content:"\u7070\u9636\u3001\u51E0\u4F55\u5F62\u72B6\u548C\u7B5B\u9009\u5F00\u5173\u7528\u4E8E\u8FA8\u8BA4\u5BF9\u8C61\u7C7B\u578B\uFF1B\u5BF9\u8C61\u5206\u7EC4\u4EC5\u6539\u53D8\u89C2\u5BDF\u5E03\u5C40\uFF0C\u4E0D\u6539\u53D8\u56FE\u7ED3\u6784\u3001ID \u6216\u63A8\u7406\u8BED\u4E49\u3002",source:"\u53EF\u89C6\u5316\u8BED\u4E49\u7EA6\u675F",time:"V13.0",related:["EVT-010","EVT-011","RULE-VISUAL-ENCODING"]}],jt=[{id:"RULE-GRAPH-AUTHORITY",kind:"rule",title:"\u6743\u5A01\u56FE\u5199\u5165\u89C4\u5219",summary:"\u4EFB\u4F55\u77E5\u8BC6\u5199\u5165\u5FC5\u987B\u843D\u5230 Canonical ID\u3001\u7248\u672C\u548C\u8BC1\u636E\u7EA6\u675F\u3002",content:"\u82E5\u5019\u9009\u5BF9\u8C61\u901A\u8FC7\u53BB\u91CD\u3001\u7C7B\u578B\u7EA6\u675F\u548C\u8BC1\u636E\u6821\u9A8C\uFF0C\u5219\u5199\u5165\u6216\u66F4\u65B0 Canonical \u8282\u70B9/\u5173\u7CFB\uFF1B\u8FD0\u884C\u65F6\u7D22\u5F15\u968F\u540E\u5F02\u6B65\u91CD\u5EFA\u3002",source:"Canonical \u89C4\u5219\u96C6",time:"ontology_version 5",related:["EVT-001","EVT-004","FACT-SINGLE-AUTHORITY","FACT-STABLE-MIGRATION"]},{id:"RULE-EVIDENCE-GROUNDED",kind:"rule",title:"\u8BC1\u636E\u843D\u5730\u89C4\u5219",summary:"\u53EF\u5916\u90E8\u6838\u9A8C\u7684\u7ED3\u8BBA\u5FC5\u987B\u81F3\u5C11\u7ED1\u5B9A\u4E00\u6761\u6709\u6548 EvidenceLink\u3002",content:"\u5F53\u7ED3\u8BBA\u6765\u81EA\u6587\u6863\u4E8B\u5B9E\u65F6\uFF0C\u8BC1\u660E\u5FC5\u987B\u8FD4\u56DE Document\u3001Chunk \u4E0E\u5B9A\u4F4D\u4FE1\u606F\uFF1B\u65E0\u6765\u6E90\u7684\u76F8\u4F3C\u5019\u9009\u53EA\u80FD\u4F5C\u4E3A\u5047\u8BBE\uFF0C\u4E0D\u80FD\u5347\u7EA7\u4E3A\u5DF2\u8BC1\u4E8B\u5B9E\u3002",source:"Canonical \u89C4\u5219\u96C6",time:"ontology_version 5",related:["EVT-002","EVT-008","FACT-EVIDENCE-SEPARATE","FACT-PROVENANCE"]},{id:"RULE-ACTIVATION-BOUND",kind:"rule",title:"\u6FC0\u6D3B\u9884\u7B97\u89C4\u5219",summary:"\u5019\u9009\u53EC\u56DE\u3001\u5173\u7CFB\u6269\u5C55\u4E0E\u9875\u9762\u6E32\u67D3\u90FD\u53D7\u660E\u786E\u9884\u7B97\u7EA6\u675F\u3002",content:"\u8FBE\u5230\u8282\u70B9\u3001\u8DF3\u6570\u3001\u8BC1\u660E\u6DF1\u5EA6\u6216\u8017\u65F6\u4E0A\u9650\u65F6\u6682\u505C\u6269\u5C55\u5E76\u8FD4\u56DE continuation\uFF1B\u5DF2\u52A0\u8F7D\u96C6\u5408\u4ECD\u4FDD\u6301\u53EF\u89E3\u91CA\u548C\u53EF\u5206\u9875\u3002",source:"\u67E5\u8BE2\u89C4\u5212\u89C4\u5219",time:"\u8FD0\u884C\u65F6",related:["EVT-003","EVT-006","EVT-007","EVT-012","FACT-ACTIVATED-BOUNDED","FACT-ANN-RERANK"]},{id:"RULE-INFERENCE-PROOF",kind:"rule",title:"\u5B8C\u6574\u56FE\u8BC1\u660E\u89C4\u5219",summary:"\u63A8\u7406\u7ED3\u8BBA\u5FC5\u987B\u9644\u5E26\u53EF\u590D\u7B97\u7684\u6700\u5C0F\u8BC1\u660E\u8DEF\u5F84\u3002",content:"\u89C4\u5219\u5F15\u64CE\u6309\u9700\u4ECE\u6FC0\u6D3B\u5B50\u56FE\u5411 Canonical L3 \u6269\u5C55\uFF0C\u8BB0\u5F55\u6BCF\u4E2A\u524D\u63D0\u3001\u5173\u7CFB\u548C\u89C4\u5219\u7248\u672C\uFF1B\u65E0\u53EF\u6EE1\u8DB3\u8BC1\u660E\u65F6\u4E0D\u8F93\u51FA\u786E\u5B9A\u6027\u7ED3\u8BBA\u3002",source:"\u63A8\u7406\u89C4\u5219\u96C6",time:"\u7248\u672C\u5316",related:["EVT-005","EVT-009","FACT-LOGICAL-SCOPE","FACT-PROVENANCE","ENT-CANONICAL-RULE"]},{id:"RULE-VISUAL-ENCODING",kind:"pattern",title:"Canonical \u89C6\u56FE\u7F16\u7801\u6A21\u5F0F",summary:"\u4E00\u4E2A\u56FE\u8FB9\u754C\u3001\u4E09\u79CD\u5BF9\u8C61\u5F62\u72B6\u3001\u5168\u7A0B\u9ED1\u767D\u7070\u3002",content:"\u4E8B\u4EF6\u4F7F\u7528\u77F3\u58A8\u9ED1\u5FAE\u70B9\uFF0C\u5B9E\u4F53\u4E0E\u4E8B\u5B9E\u4F7F\u7528\u4E2D\u7070\u7EBF\u6846\u51E0\u4F55\uFF0C\u6A21\u5F0F\u4E0E\u89C4\u5219\u4F7F\u7528\u6D45\u7070\u591A\u9762\u4F53\uFF1B\u660E\u6697\u548C\u5C3A\u5BF8\u53EA\u8868\u793A\u6FC0\u6D3B\u5F3A\u5EA6\u3002",source:"V13.0 \u524D\u7AEF\u6A21\u5F0F",time:"\u7248\u672C\u5316",related:["EVT-010","EVT-011","FACT-VISUAL-FUSION"]}],fn=new M(0,.45,-1.15);Ue.position.copy(fn);let ht={event:{color:2368548,shellOpacity:.58,nodeOpacity:.92,label:new M(-7.2,7.6,3.4)},fact:{color:7368816,shellOpacity:.52,nodeOpacity:.94,label:new M(0,7.9,3.4)},schema:{color:12105912,shellOpacity:.14,nodeOpacity:.88,label:new M(7.2,7.6,3.4)}},cn={fused:{event:{offset:new M(0,0,0),radii:new M(8.25,6.15,5.45),shellScale:new M(8.75,6.6,5.9),label:new M(0,7.35,3.35)},fact:{offset:new M(0,0,0),radii:new M(8.25,6.15,5.45),shellScale:new M(8.75,6.6,5.9)},schema:{offset:new M(0,0,0),radii:new M(8.25,6.15,5.45),shellScale:new M(8.75,6.6,5.9)}},grouped:{event:{offset:new M(-7,.25,.4),radii:new M(3.9,6.55,3.55),shellScale:new M(4.35,6.95,3.85)},fact:{offset:new M(0,.2,.8),radii:new M(3.85,5.55,3.5),shellScale:new M(4.35,5.95,3.85)},schema:{offset:new M(7,.25,1.2),radii:new M(3.45,4.65,3.2),shellScale:new M(3.95,5.05,3.55)}}},hn={event:{full:"\u4E8B\u4EF6\u5BF9\u8C61 \xB7 \u77F3\u58A8\u5FAE\u70B9",compact:"\u4E8B\u4EF6"},fact:{full:"\u5B9E\u4F53 / \u4E8B\u5B9E \xB7 \u4E2D\u7070\u7EBF\u6846",compact:"\u5B9E\u4F53 / \u4E8B\u5B9E"},schema:{full:"\u6A21\u5F0F / \u89C4\u5219 \xB7 \u6D45\u7070\u591A\u9762\u4F53",compact:"\u6A21\u5F0F / \u89C4\u5219"}},ma={grouped:{event:{offset:new M(-1.65,.18,.4),radii:new M(1.35,5.35,2.8),shellScale:new M(1.7,5.7,3.1),label:new M(-1.1,7.25,3.3)},fact:{offset:new M(0,.16,.62),radii:new M(1.3,4.75,2.65),shellScale:new M(1.65,5.1,2.95),label:new M(0,7.55,3.3)},schema:{offset:new M(1.65,.18,.86),radii:new M(1.25,4.2,2.45),shellScale:new M(1.6,4.6,2.8),label:new M(1.1,7.25,3.3)}}};function fa(v){let S=new Dt;if(S.userData.memoryKind=v,v==="event"){let C=[];for(let ee=0;ee<210;ee++){let re=Yh(ee,210,new M(1,1,1),.35);C.push(re.x,re.y,re.z)}let k=new tt;k.setAttribute("position",new Le(C,3));let q=new Dr({color:ht.event.color,size:.11,transparent:!0,opacity:ht.event.shellOpacity,sizeAttenuation:!0,depthTest:!1,depthWrite:!1}),$=new ni(k,q);$.renderOrder=7,S.add($)}else if(v==="fact"){let C=new ii(new Ur(1,1)),O=new si({color:ht.fact.color,dashSize:.08,gapSize:.055,transparent:!0,opacity:ht.fact.shellOpacity,depthTest:!1,depthWrite:!1}),k=new ar(C,O);k.computeLineDistances(),k.renderOrder=8,S.add(k)}else{let C=new Ur(1,2),O=new Bt(C,new xn({color:ht.schema.color,transparent:!0,opacity:ht.schema.shellOpacity,depthTest:!1,depthWrite:!1,side:Un}));O.renderOrder=7,S.add(O);let k=new ar(new ii(C),new Yt({color:5592405,transparent:!0,opacity:.32,depthTest:!1,depthWrite:!1}));k.renderOrder=8,S.add(k)}return xt.add(S),S}let bi=fa("event"),jh=fa("fact"),qh=fa("schema");function ga(){bi.visible=at&&(!Me||Ft),jh.visible=at&&Me&&Bn,qh.visible=at&&Me&&Fn;let v=bi.children[0]?.material;v&&(v.color.setHex(Me?ht.event.color:9079434),v.opacity=Me?ht.event.shellOpacity:.22)}function Yh(v,S,C,O=0){let k=Math.PI*(3-Math.sqrt(5)),q=1-v/Math.max(1,S-1)*2,$=Math.sqrt(Math.max(0,1-q*q)),ee=k*v+O;return new M(Math.cos(ee)*$*C.x,q*C.y,Math.sin(ee)*$*C.z)}function Al(v){let S=2166136261;for(let C=0;C<v.length;C++)S^=v.charCodeAt(C),S=Math.imul(S,16777619);return S^=S>>>16,S=Math.imul(S,2146121005),S^=S>>>15,(S>>>0)/4294967295}function Op(v,S){let C=Al(v+":longitude")*Math.PI*2,O=Al(v+":latitude")*2-1,k=Math.sqrt(Math.max(0,1-O*O)),q=.3+Math.cbrt(Al(v+":radius"))*.68;return new M(Math.cos(C)*k*S.x*q,O*S.y*q,Math.sin(C)*k*S.z*q)}function Bp(v,S,C,O=0){let k=Yh(v,S,C,O),q=.48+((v+1)*.61803398875+O)%1*.48;return k.multiplyScalar(q)}function Rl(){return Me?c.clientWidth<=900?ma.grouped:cn.grouped:cn.fused}function Kh(v,S,C,O=0,k=""){let q=Rl()[v];return(Me?Bp(S,C,q.radii,O):Op(k,q.radii)).add(q.offset)}function Si(v,S,C,O){let k,q,$,ee=0;S==="event"?(k=new Or(.145,7,7),q=new xn({color:ht.event.color,transparent:!0,opacity:ht.event.nodeOpacity,depthTest:!1,depthWrite:!1}),ee=.2):S==="fact"?(k=new ea(.46,0),q=new xn({color:ht.fact.color,wireframe:!0,transparent:!0,opacity:ht.fact.nodeOpacity,depthTest:!1,depthWrite:!1}),ee=1.1):(k=new Ur(.58,0),q=new xn({color:ht.schema.color,transparent:!0,opacity:ht.schema.nodeOpacity,depthTest:!1,depthWrite:!1}),$=new M(3.18,2.38,2.7),ee=2);let re=new Bt(k,q);if(S==="schema"){let le=new ar(new Ji(k),new Yt({color:5592405,transparent:!0,opacity:.72,depthTest:!1,depthWrite:!1}));le.renderOrder=37,re.add(le)}return re.position.copy(Kh(S,C,O,ee,v.id)),re.renderOrder=S==="event"?32:S==="fact"?34:36,re.userData.memoryData=v,re.userData.memoryKind=S,re.userData.layoutIndex=C,re.userData.layoutCount=O,re.userData.layoutPhase=ee,re.userData.baseScale=1,re.userData.baseOpacity=q.opacity,re.userData.baseColor=ht[S].color,v._position=re.position.clone(),Kn.push(re),mt.set(v.id,re),S==="event"&&ut.add(re),S==="fact"&&_t.add(re),S==="schema"&&bt.add(re),re}nn.forEach((v,S)=>Si(v,"event",S,nn.length)),ct.forEach((v,S)=>Si(v,"fact",S,ct.length)),jt.forEach((v,S)=>Si(v,"schema",S,jt.length));function Fp(){let v=Rl(),S=Me&&c.clientWidth<=900,C={event:o.getElementById("memoryKindEventLabel"),fact:o.getElementById("memoryKindFactLabel"),schema:o.getElementById("memoryKindSchemaLabel")};Object.entries(C).forEach(([O,k])=>{k.textContent=Me?hn[O][S?"compact":"full"]:O==="event"?"Canonical L3 \xB7 \u5F53\u524D\u6FC0\u6D3B\u5B50\u56FE":"";let q=v[O].label||v[O].offset.clone().add(new M(0,v[O].radii.y+1,3.2));ou[O].copy(fn).add(q).multiplyScalar(1.24).add(ve.position),k.dataset.layout=Me?"grouped":"fused"})}function kp(){let v=Rl();[["event",bi],["fact",jh],["schema",qh]].forEach(([S,C])=>{C.position.copy(v[S].offset),C.scale.copy(v[S].shellScale)}),ga()}function Zh(v){let S=mt.get(v.userData.fromId),C=mt.get(v.userData.toId);if(!S||!C)return;let O=v.geometry.getAttribute("position");O.setXYZ(0,S.position.x,S.position.y,S.position.z),O.setXYZ(1,C.position.x,C.position.y,C.position.z),O.needsUpdate=!0,v.geometry.computeBoundingSphere(),v.material.isLineDashedMaterial&&v.computeLineDistances()}function Hp(){Zt.forEach(Zh),Xr.forEach(v=>{let S=mt.get(v.userData.targetId);if(!S)return;let C=v.geometry.getAttribute("position");C.setXYZ(1,S.position.x,S.position.y,S.position.z),C.needsUpdate=!0,v.geometry.computeBoundingSphere()}),typeof Ai<"u"&&Ai.children.forEach(Zh)}function Cl(){Kn.forEach(v=>{v.position.copy(Kh(v.userData.memoryKind,v.userData.layoutIndex,v.userData.layoutCount,v.userData.layoutPhase,v.userData.memoryData.id)),v.userData.basePosition=v.position.clone()}),kp(),Hp(),Fp()}function ya(v,S,C){let O=mt.get(v),k=mt.get(S);if(!O||!k)return;let q=new tt().setFromPoints([O.position.clone(),k.position.clone()]),$=C==="event-fact"?.16:C==="fact-schema"?.28:.22,ee={color:C==="event-fact"?ht.event.color:ht.fact.color,transparent:!0,opacity:$,depthTest:!1},re=C==="event-fact"?new si({...ee,dashSize:.22,gapSize:.16}):new Yt(ee),le=new Dn(q,re);le.renderOrder=10,le.userData.fromId=v,le.userData.toId=S,le.userData.kind=C,le.userData.baseOpacity=$,re.isLineDashedMaterial&&le.computeLineDistances(),C==="event-fact"?dt.add(le):je.add(le),Zt.push(le)}nn.forEach(v=>{v.related.filter(S=>S.startsWith("ENT-")||S.startsWith("FACT-")).slice(0,2).forEach(S=>ya(v.id,S,"event-fact"))}),ct.forEach(v=>{v.related.filter(S=>S.startsWith("RULE-")).slice(0,2).forEach(S=>ya(v.id,S,"fact-schema"))});let va=new Dt;Ue.add(va),[new M(-4.7,-1,-1.5).sub(fn),new M(4.7,-1,-1.5).sub(fn)].forEach((v,S)=>{nn.forEach((C,O)=>{if(O%2!==S)return;let k=mt.get(C.id);if(!k)return;let q=new tt().setFromPoints([v,k.position.clone()]),$=new Yt({color:0,transparent:!0,opacity:.014,depthTest:!1}),ee=new Dn(q,$);ee.renderOrder=9,ee.userData.targetId=C.id,va.add(ee),Xr.push(ee)})});function Vp(v){for(;v.children.length;)v.children.pop().traverse?.(C=>{C.geometry&&C.geometry.dispose(),C.material&&(Array.isArray(C.material)?C.material:[C.material]).forEach(k=>k.dispose?.())})}function zp(){[ut,_t,bt,dt,je,va].forEach(Vp),Kn.length=0,mt.clear(),Zt.length=0,Xr.length=0,Bl(),It=null,kt=null,nn.forEach((v,S)=>Si(v,"event",S,nn.length)),ct.forEach((v,S)=>Si(v,"fact",S,ct.length)),jt.forEach((v,S)=>Si(v,"schema",S,jt.length)),kn?.relations?.length?kn.relations.forEach(v=>{let S=mt.get(v.source_node_id),C=mt.get(v.target_node_id);if(!S||!C)return;let O=S.userData.memoryKind,k=C.userData.memoryKind,q=O==="event"&&k==="fact"?"event-fact":O==="fact"&&k==="schema"?"fact-schema":"canonical";ya(v.source_node_id,v.target_node_id,q)}):(nn.forEach(v=>{v.related.filter(S=>S.startsWith("ENT-")||S.startsWith("FACT-")).slice(0,2).forEach(S=>ya(v.id,S,"event-fact"))}),ct.forEach(v=>{v.related.filter(S=>S.startsWith("RULE-")).slice(0,2).forEach(S=>ya(v.id,S,"fact-schema"))})),[new M(-4.7,-1,-1.5).sub(fn),new M(4.7,-1,-1.5).sub(fn)].forEach((v,S)=>{nn.forEach((C,O)=>{if(O%2!==S)return;let k=mt.get(C.id);if(!k)return;let q=new tt().setFromPoints([v,k.position.clone()]),$=new Yt({color:0,transparent:!0,opacity:.014,depthTest:!1}),ee=new Dn(q,$);ee.renderOrder=9,ee.userData.targetId=C.id,va.add(ee),Xr.push(ee)})}),Cl(),Ti(),ce()}let As=o.getElementById("memoryPanel");function jr(v,S){let C=o.getElementById(v);C.textContent=S??"\u2014"}function Gp(v,S){kt=v,$h(S);let C={event:"Canonical L3 \xB7 \u4E8B\u4EF6\u5BF9\u8C61",fact:"Canonical L3 \xB7 \u5B9E\u4F53 / \u4E8B\u5B9E",schema:"Canonical L3 \xB7 \u6A21\u5F0F / \u89C4\u5219"},O={event:"\u4E8B\u4EF6",entity:"\u5B9E\u4F53",fact:"\u4E8B\u5B9E",rule:"\u89C4\u5219",pattern:"\u6A21\u5F0F"},k=S.userData.memoryKind;As.dataset.layer=k,jr("memoryPanelKicker",C[k]||"CANONICAL NODE"),jr("memoryPanelTitle",v.title),jr("memoryPanelId",v.id+" / "+(O[v.kind]||C[k]||k)),jr("memoryPanelSummary",v.summary),jr("memoryPanelContent",v.content),jr("memoryPanelSource",`${v.source||"\u2014"}
${v.time||""}`),jr("memoryPanelRelations",(v.related||[]).join("  \xB7  ")||"\u2014"),As.classList.remove("hidden"),Il(v.id),ft()}function Jh(){As.classList.add("hidden"),As.dataset.layer="",kt=null,$h(null),Qh(),ft()}function Rs(v){if(!v)return 1;let S=v.userData.memoryKind;return S==="event"?2.15:S==="fact"?1.55:1.4}function $h(v){It&&It!==v&&It.scale.setScalar(1),It=v,It&&It.scale.setScalar(Rs(It))}function Qh(){Zt.forEach(v=>{v.material.opacity=v.userData.baseOpacity}),Kn.forEach(v=>{v!==It&&v.scale.setScalar(1)})}function Il(v){Zt.forEach(S=>{let C=S.userData.fromId===v||S.userData.toId===v;if(S.material.opacity=C?.74:.025,C){let O=S.userData.fromId===v?S.userData.toId:S.userData.fromId,k=mt.get(O);if(k&&k!==It){let q=k.userData.memoryKind;k.scale.setScalar(q==="event"?1.55:1.22)}}})}o.getElementById("memoryPanelClose").addEventListener("click",Jh),o.getElementById("focusMemoryNodeBtn").addEventListener("click",()=>{if(!It)return;let v=new M;It.getWorldPosition(v),Z.target.copy(v),m.position.copy(v.clone().add(new M(0,3.4,15.5))),Z.update(),ft()}),o.getElementById("traceMemoryNodeBtn").addEventListener("click",()=>{kt&&(Il(kt.id),gn(`\u6B63\u5728\u8FFD\u8E2A\uFF1A${kt.title}`),ft())});let eu=new ms,Ll=new oe,_a=null;g.domElement.addEventListener("pointerdown",v=>{_a={x:v.clientX,y:v.clientY}}),g.domElement.addEventListener("pointerup",v=>{if(!_a||!at)return;let S=v.clientX-_a.x,C=v.clientY-_a.y;if(_a=null,Math.hypot(S,C)>5)return;let O=g.domElement.getBoundingClientRect();Ll.x=(v.clientX-O.left)/O.width*2-1,Ll.y=-((v.clientY-O.top)/O.height)*2+1,eu.setFromCamera(Ll,m);let k=Kn.filter($=>$.visible&&$.parent&&$.parent.visible),q=eu.intersectObjects(k,!1);q.length&&Gp(q[0].object.userData.memoryData,q[0].object)});function gn(v){o.getElementById("memoryStatus").textContent="Canonical L3\uFF1A"+v}function xa(){let v=Me?"\u5BF9\u8C61\u5206\u7EC4\u89C2\u5BDF":"\u5168\u56FE\u878D\u5408";return(kn?`\u771F\u5B9E\u5FEB\u7167 ${kn.snapshot_version} \xB7 `:"")+"\u5B8C\u6574\u56FE \xB7 "+v+(Ge?" \xB7 \u900F\u89C6":"")}function Ti(){let v=o.getElementById("memoryKindEventLabel"),S=o.getElementById("memoryKindFactLabel"),C=o.getElementById("memoryKindSchemaLabel");v.classList.toggle("hidden",!at||Me&&!Ft),S.classList.toggle("hidden",!at||!Me||!Bn),C.classList.toggle("hidden",!at||!Me||!Fn)}function wi(v){at=v,Ue.visible=v,xt.visible=v;let S=o.getElementById("toggleMemoryBtn");S.textContent=v?"Canonical \u56FE\u5F00":"Canonical \u56FE\u5173",S.classList.toggle("active",v),ga(),Ti(),v||Jh(),ce(),gn(v?xa():"\u5173\u95ED"),ft()}function tu(v){Ge=v;let S=o.getElementById("memoryXrayBtn");S.textContent=v?"\u56FE\u8C31\u900F\u89C6\u5F00":"\u56FE\u8C31\u900F\u89C6\u5173",S.classList.toggle("active",v),ce(),gn(at?xa():"\u5173\u95ED"),ft()}function nu(v){Me=v;let S=o.getElementById("toggleObjectGroupingBtn");S.textContent=v?"\u5BF9\u8C61\u5206\u7EC4\u5F00":"\u5BF9\u8C61\u5206\u7EC4",S.classList.toggle("active",v),S.setAttribute("aria-pressed",String(v)),xt.visible=at,Cl(),Ti(),ce(),gn(xa()),ft()}function Pl(v){Ft=v,ut.visible=v,va.visible=v,dt.visible=v&&Bn;let S=o.getElementById("toggleEventKindBtn");S.classList.toggle("active",v),S.setAttribute("aria-pressed",String(v)),ga(),Ti(),ft()}function Dl(v){Bn=v,_t.visible=v,dt.visible=v&&Ft,je.visible=v&&Fn;let S=o.getElementById("toggleFactKindBtn");S.classList.toggle("active",v),S.setAttribute("aria-pressed",String(v)),ga(),Ti(),ft()}function Nl(v){Fn=v,bt.visible=v,je.visible=v&&Bn;let S=o.getElementById("toggleSchemaKindBtn");S.classList.toggle("active",v),S.setAttribute("aria-pressed",String(v)),ga(),Ti(),ft()}function Ul(v,S){(v==="event"?ut:v==="fact"?_t:bt).children.forEach((O,k)=>{let q=Math.max(0,Math.min(1,S-k%5*.055)),$=O.userData.memoryKind,re=1+q*($==="event"?.48:$==="fact"?.62:.7),le=Rs(O);if(O.scale.setScalar(O===It?Math.max(le,re):re),O.material){let ye=O.userData.baseOpacity||.8;O.material.opacity=Math.min(1,ye+q*.2)}})}function Wp(){Kn.forEach(v=>{v.scale.setScalar(v===It?Rs(v):1),v.material&&(v.material.opacity=v.userData.baseOpacity||v.material.opacity)}),kt?Il(kt.id):Qh()}function Ol(v){if(!ln){Ht=0,U("memory",!1);return}if(n.hidden||v-Yn<G){Ht=requestAnimationFrame(Ol);return}Yn=v;let O=(v-xi)/1e3/4.8;if(O>=1){ln=null,Ht=0,Wp(),gn(xa()),U("memory",!1),ft();return}let k=re=>re<=0||re>=1?0:Math.sin(Math.PI*re),q,$,ee;ln==="consolidate"?(q=k((O-.02)/.34),$=k((O-.28)/.36),ee=k((O-.58)/.38),gn("\u5199\u5165\uFF1A\u4E8B\u4EF6\u5019\u9009 \u2192 \u5B9E\u4F53 / \u4E8B\u5B9E\u5F52\u4E00 \u2192 \u89C4\u5219\u6821\u9A8C")):(q=k((O-.02)/.34),$=k((O-.28)/.36),ee=k((O-.58)/.38),gn("\u68C0\u7D22\uFF1A\u67E5\u8BE2\u951A\u70B9 \u2192 \u5019\u9009\u91CD\u6392\u5E8F \u2192 \u89C4\u5219\u4E0E\u8BC1\u660E\u6269\u5C55")),Ul("event",q),Ul("fact",$),Ul("schema",ee),Zt.forEach(re=>{let le=0;re.userData.kind==="event-fact"?le=Math.max(q,$):le=Math.max($,ee),re.material.opacity=re.userData.baseOpacity+le*.58}),ft(),Ht=requestAnimationFrame(Ol)}function ru(v){at||wi(!0),ln=v,xi=performance.now(),Yn=0,U("memory",!0),Ht&&cancelAnimationFrame(Ht),Ht=requestAnimationFrame(Ol)}let Er=[{event:"EVT-001",fact:"FACT-SINGLE-AUTHORITY",schema:"RULE-GRAPH-AUTHORITY",evidence:"\u67B6\u6784\u51B3\u7B56\u8BB0\u5F55 / Document \u2192 Section \u2192 Chunk"},{event:"EVT-002",fact:"FACT-EVIDENCE-SEPARATE",schema:"RULE-EVIDENCE-GROUNDED",evidence:"\u9879\u76EE\u6587\u6863\u4E0E\u4EE3\u7801\u6838\u5BF9 / EvidenceLink \u2192 Chunk"},{event:"EVT-003",fact:"FACT-ACTIVATED-BOUNDED",schema:"RULE-ACTIVATION-BOUND",evidence:"\u89C4\u6A21\u98CE\u9669\u8BA8\u8BBA / \u67E5\u8BE2\u9884\u7B97\u8BB0\u5F55 \u2192 Chunk"},{event:"EVT-005",fact:"FACT-LOGICAL-SCOPE",schema:"RULE-INFERENCE-PROOF",evidence:"\u63A8\u7406\u67B6\u6784\u8BA8\u8BBA / \u89C4\u5219\u7248\u672C + \u8F93\u5165\u4E8B\u5B9E + Chunk"},{event:"EVT-010",fact:"FACT-VISUAL-FUSION",schema:"RULE-VISUAL-ENCODING",evidence:"\u524D\u7AEF\u53EF\u89C6\u5316\u51B3\u7B56 / \u9700\u6C42\u8BB0\u5F55 \u2192 Chunk"}],Ea=0,Cs=!1,Ai=new Dt;Ue.add(Ai);function Bl(){for(;Ai.children.length;){let v=Ai.children.pop();v.geometry&&v.geometry.dispose(),v.material&&v.material.dispose()}}function iu(v,S,C=.95,O="",k=""){let q=new tt().setFromPoints([v,S]),$=new Yt({color:0,transparent:!0,opacity:C,depthTest:!1}),ee=new Dn(q,$);return ee.renderOrder=40,ee.userData.fromId=O,ee.userData.toId=k,Ai.add(ee),ee}function Xp(v,S,C,O){o.getElementById("chainEventText").textContent=`${v.title}\uFF08${v.id}\uFF09`,o.getElementById("chainFactText").textContent=`${S.title}\uFF08${S.id}\uFF09`,o.getElementById("chainSchemaText").textContent=`${C.title}\uFF08${C.id}\uFF09`,o.getElementById("chainEvidenceText").textContent=O||"Document / Chunk \u8BC1\u636E\u5F85\u52A0\u8F7D"}function au(){Kn.forEach(v=>{v.scale.setScalar(v===It?Rs(v):1);let S=v.userData.memoryKind;v.material.opacity=ht[S].nodeOpacity,v.material.color.setHex(ht[S].color)}),Zt.forEach(v=>{v.material.opacity=v.userData.baseOpacity})}function Is(v=0,S=!1){if(!Er.length){Cs=!1,gn(kn?`\u771F\u5B9E\u5FEB\u7167 ${kn.snapshot_version} \xB7 \u5F53\u524D\u9875\u6CA1\u6709\u53EF\u7EC4\u5408\u7684\u4E09\u7C7B\u8BC1\u660E\u8282\u70B9`:"\u6682\u65E0\u8BC1\u660E\u8DEF\u5F84"),ft();return}at||wi(!0),Pl(!0),Dl(!0),Nl(!0),Ea=(v%Er.length+Er.length)%Er.length,Cs=!0;let C=Er[Ea],O=mt.get(C.event),k=mt.get(C.fact),q=mt.get(C.schema);if(!O||!k||!q)return;let $=O.userData.memoryData,ee=k.userData.memoryData,re=q.userData.memoryData;Xp($,ee,re,C.evidence),au(),Bl();let le=new Set([C.event,C.fact,C.schema]);if(Kn.forEach(ye=>{let He=ye.userData.memoryData.id,Qe=ye.userData.memoryKind;le.has(He)?(Qe==="event"&&ye.scale.setScalar(2.65),Qe==="fact"&&ye.scale.setScalar(1.95),Qe==="schema"&&ye.scale.setScalar(1.7),ye.material.opacity=1):(ye.scale.setScalar(.88),ye.material.opacity=ht[Qe].nodeOpacity*.28)}),Zt.forEach(ye=>{let He=ye.userData.fromId,Qe=ye.userData.toId,et=He===C.event&&Qe===C.fact||He===C.fact&&Qe===C.event,We=He===C.fact&&Qe===C.schema||He===C.schema&&Qe===C.fact;ye.material.opacity=et||We?.95:.015}),iu(O.position,k.position,.98,C.event,C.fact),iu(k.position,q.position,.98,C.fact,C.schema),gn(`\u8BC1\u660E ${Ea+1}/${Er.length}\uFF1A\u67E5\u8BE2\u951A\u70B9 \u2192 \u4E8B\u5B9E\u7EA6\u675F \u2192 \u89C4\u5219\u8BC1\u660E \u2192 \u6587\u6863\u8BC1\u636E`),S){let He=O.position.clone().add(k.position).add(q.position).multiplyScalar(.3333333333333333).clone().add(Ue.position).multiplyScalar(1.24).add(ve.position);Z.target.copy(He),m.position.copy(He.clone().add(new M(0,2.4,19))),Z.update()}ft()}function jp(){Cs=!1,au(),Bl(),o.getElementById("chainEventText").textContent="\u2014",o.getElementById("chainFactText").textContent="\u2014",o.getElementById("chainSchemaText").textContent="\u2014",o.getElementById("chainEvidenceText").textContent="\u2014",gn(xa()),ft()}function Fl(v){let S=String(v||"event").toLowerCase();return["entity","fact","attribute","property"].includes(S)?"fact":["rule","pattern","schema"].includes(S)?"schema":"event"}function su(v,S,C){let O=String(v.statement||"").trim(),k=O?O.split(/[。！？.!?]/)[0].trim().slice(0,96):v.id,q=(v.evidence_links||[]).map(re=>re.link||re),$=q[0],ee=$?`EvidenceLink \xB7 ${$.source_locator||$.chunk_id||"Chunk"}`:`${v.document_id||"Canonical L3"} / ${v.section_id||"snapshot"}`;return{id:v.id,kind:Fl(v.node_kind),title:k||v.id,summary:`${v.node_kind||"event"} \xB7 ${v.semantic_type||"canonical"} \xB7 depth ${v.depth??0}`,content:O||`${v.id}\uFF08${v.node_kind||"event"}\uFF09`,source:ee,time:`snapshot ${S.snapshot_version}`,related:C,score:v.score,confidence:v.confidence,status:v.status,evidence:q}}function qp(v){let S=v.nodes||[],C=v.anchor_node_id||S[0]?.id,O=S.find(q=>q.id===C)||S[0],k=(v.proof||[]).find(q=>q.kind==="evidence");o.getElementById("chainEventText").textContent=O?`${su(O,v,[]).title}\uFF08${O.id}\uFF09`:"\u2014",o.getElementById("chainFactText").textContent=S.some(q=>Fl(q.node_kind)==="fact")?"\u5B9E\u4F53 / \u4E8B\u5B9E\u5019\u9009\u5DF2\u5728\u771F\u5B9E\u5FEB\u7167\u4E2D\u8FD4\u56DE":"\u5F53\u524D\u5FEB\u7167\u672A\u8FD4\u56DE\u5B9E\u4F53 / \u4E8B\u5B9E\u8282\u70B9",o.getElementById("chainSchemaText").textContent=(v.rules||[]).length||S.some(q=>Fl(q.node_kind)==="schema")?"\u6A21\u5F0F / \u89C4\u5219\u5019\u9009\u5DF2\u5728\u771F\u5B9E\u5FEB\u7167\u4E2D\u8FD4\u56DE":"\u5F53\u524D\u5FEB\u7167\u672A\u8FD4\u56DE\u6A21\u5F0F / \u89C4\u5219\u8282\u70B9",o.getElementById("chainEvidenceText").textContent=k?`${k.source_locator||k.chunk_id||"EvidenceLink"} \xB7 ${String(k.quote||"").slice(0,120)}`:`${v.evidence?.length||0} \u6761 EvidenceLink \xB7 Document / Section / Chunk`}function Yp(v,S){if(!v||v.snapshot_version!==S.snapshot_version)return S;let C=(k=[],q=[])=>{let $=new Map(k.map(ee=>[ee.id,ee]));return q.forEach(ee=>$.set(ee.id,ee)),[...$.values()]},O=(k=[],q=[])=>{let $=re=>`${re.subject_type}:${re.subject_id}:${re.link?.id||re.id||""}`,ee=new Map(k.map(re=>[$(re),re]));return q.forEach(re=>ee.set($(re),re)),[...ee.values()]};return{...S,nodes:C(v.nodes,S.nodes),relations:C(v.relations,S.relations),attributes:C(v.attributes,S.attributes),rules:C(v.rules,S.rules),proof:S.proof?.length?S.proof:v.proof,evidence:O(v.evidence,S.evidence)}}function Kp(v){if(!v||!v.read_only||!Array.isArray(v.nodes))throw new Error("\u771F\u5B9E\u5FEB\u7167\u5951\u7EA6\u65E0\u6548");if(!v.nodes.length)throw new Error("\u771F\u5B9E\u5FEB\u7167\u4E3A\u7A7A");let S=new Map;(v.relations||[]).forEach($=>{[$.source_node_id,$.target_node_id].forEach(ee=>{if(!ee)return;S.has(ee)||S.set(ee,[]);let re=ee===$.source_node_id?$.target_node_id:$.source_node_id;re&&!S.get(ee).includes(re)&&S.get(ee).push(re)})}),kn=v,Wr="api",Ei=v.continuation?.next_cursor||null,window.__canonicalSnapshot=v,window.__canonicalSnapshotSource=Wr;let C=o.getElementById("memoryLoadMoreBtn");C.classList.toggle("hidden",!Ei),C.disabled=!1,nn=[],ct=[],jt=[],v.nodes.forEach($=>{let ee=su($,v,S.get($.id)||[]);ee.kind==="fact"?ct.push(ee):ee.kind==="schema"?jt.push(ee):nn.push(ee)}),(v.attributes||[]).forEach($=>{mt.has($.id)||ct.push({id:$.id,kind:"fact",title:$.attribute_type||$.id,summary:"Canonical attribute fact",content:JSON.stringify($.value??null),source:`Canonical Attribute \xB7 ${$.id}`,time:`snapshot ${v.snapshot_version}`,related:[$.node_id].filter(Boolean)})}),(v.rules||[]).forEach($=>{mt.has($.id)||jt.push({id:$.id,kind:"schema",title:$.name||$.id,summary:"Canonical rule",content:$.description||$.name||$.id,source:`Canonical Rule \xB7 ${$.id}`,time:`ontology_version ${$.ontology_version}`,related:[]})}),zp(),Er=[];let O=nn[0],k=ct[0],q=jt[0];O&&k&&q?(Er.push({event:O.id,fact:k.id,schema:q.id,evidence:`${v.evidence?.length||0} \u6761 EvidenceLink \xB7 ${v.snapshot_version}`}),Is(0,!1)):(Cs=!1,qp(v)),gn(`\u771F\u5B9E\u5FEB\u7167 ${v.snapshot_version} \xB7 ${v.nodes.length} \u8282\u70B9 / ${(v.relations||[]).length} \u5173\u7CFB`),ft()}async function Zp(v=null){Ze=!0;let S=o.getElementById("memoryLoadMoreBtn");S.disabled=!0,gn(v?"\u771F\u5B9E\u5FEB\u7167\u7EED\u8F7D\u4E2D \xB7 \u4FDD\u7559\u5F53\u524D\u9875\u9762":"\u771F\u5B9E\u5FEB\u7167\u52A0\u8F7D\u4E2D \xB7 \u4FDD\u7559\u672C\u5730\u6F14\u793A");let C=new AbortController,O=window.setTimeout(()=>C.abort(),12e3);try{let k=await fetch("/api/graph/snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query:"Canonical L3 \u8BA4\u77E5\u8BB0\u5FC6",node_limit:12,relation_limit:48,proof_limit:12,max_hops:2,use_embedding:!1,...v?{cursor:v}:{}}),signal:C.signal});if(!k.ok)throw new Error(`snapshot HTTP ${k.status}`);let q=await k.json();Kp(Yp(v?kn:null,q))}catch(k){Wr="demo",window.__canonicalSnapshotSource=Wr,gn(`\u771F\u5B9E\u5FEB\u7167\u4E0D\u53EF\u7528 \xB7 \u4FDD\u7559\u672C\u5730\u6F14\u793A\uFF08${String(k.message||k).slice(0,80)}\uFF09`),ft()}finally{window.clearTimeout(O),Ze=!1,S.disabled=!1}}let kl=new Dt;_.add(kl);let qr={prefrontal:new M(10.2,7.6,9.8).multiplyScalar(1.24).add(ve.position),parietal:new M(4,12.4,.6).multiplyScalar(1.24).add(ve.position),temporal:new M(10.7,-.2,2.8).multiplyScalar(1.24).add(ve.position),occipital:new M(5.4,5.9,-10.8).multiplyScalar(1.24).add(ve.position),cerebellum:new M(4.8,-6.6,-7.6).multiplyScalar(1.24).add(ve.position),brainstem:new M(0,-12.9,-5.9).multiplyScalar(1.24).add(ve.position),hippocampus:new M(4.7,-1,-1.5).multiplyScalar(1.24).add(ve.position)},Mr={tagPrefrontal:new M(17,15,15),tagParietal:new M(3,20,7),tagTemporal:new M(19,2,11),tagOccipital:new M(12,12,-17),tagCerebellum:new M(12,-7,-16),tagBrainstem:new M(2,-18,-11),tagHippocampus:new M(12,-4,5)},Jp=new M,ou={event:fn.clone().add(new M(9,5.8,4.8)).multiplyScalar(1.24).add(ve.position),fact:fn.clone().add(new M(6.2,3.8,3.2)).multiplyScalar(1.24).add(ve.position),schema:fn.clone().add(new M(3.4,2,1.6)).multiplyScalar(1.24).add(ve.position)};function Yr(v,S){let C=new tt().setFromPoints([v,S]),O=new si({color:0,dashSize:.42,gapSize:.28,transparent:!0,opacity:.28}),k=new Dn(C,O);k.computeLineDistances(),kl.add(k)}Yr(Mr.tagPrefrontal,qr.prefrontal),Yr(Mr.tagParietal,qr.parietal),Yr(Mr.tagTemporal,qr.temporal),Yr(Mr.tagOccipital,qr.occipital),Yr(Mr.tagCerebellum,qr.cerebellum),Yr(Mr.tagBrainstem,qr.brainstem),Yr(Mr.tagHippocampus,qr.hippocampus);function lu(v){w=v;let S=o.getElementById("toggleRegionsBtn");S.textContent=v?"\u5206\u533A\u5F00":"\u5206\u533A\u5173",S.classList.toggle("active",v),ue.forEach(C=>{let O=C.userData.region||"parietal";v?C.material.color.setHex(Re[O]||14013909):C.material.color.setHex(14145495)}),me.forEach(({proxy:C})=>{let O=C.userData.region||"parietal";C.material.color.setHex(v?Re[O]||14013909:14145495)}),ft()}function cu(v){T=v;let S=o.getElementById("toggleCoreBtn");S.textContent=v?"\u5185\u90E8\u5F00":"\u5185\u90E8\u5173",S.classList.toggle("active",v),ge.forEach(C=>C.visible=v),ce(),ft()}function Ls(v){H=v;let S=o.getElementById("toggleGridBtn");S.textContent=v?"\u7F51\u683C\u5F00":"\u7F51\u683C\u5173",S.classList.toggle("active",v),pe.visible=v,ft()}function hu(v){Ve=v;let S=o.getElementById("toggleLabelsBtn");S.textContent=v?"\u6807\u7B7E\u5F00":"\u6807\u7B7E\u5173",S.classList.toggle("active",v),["tagPrefrontal","tagParietal","tagTemporal","tagOccipital","tagCerebellum","tagBrainstem","tagHippocampus"].forEach(C=>o.getElementById(C).classList.toggle("hidden",!v)),kl.visible=v,ft()}let Hl={axisX:new M(ae+.6,0,0),axisY:new M(0,ae+.6,0),axisZ:new M(0,0,ae+.6)};function Ma(v,S){let C=Jp.copy(S).project(m);if(!(C.z>-1&&C.z<1)){v.style.display="none";return}v.style.display="block";let k=(C.x*.5+.5)*c.clientWidth,q=(-C.y*.5+.5)*c.clientHeight;Vl(v,k,q)}function Vl(v,S,C){let k=Math.max(0,v.offsetWidth/2),q=Math.max(0,v.offsetHeight/2),$=Math.max(6+k,Math.min(c.clientWidth-6-k,S)),ee=Math.max(6+q,Math.min(c.clientHeight-6-q,C));v.style.left=`${$}px`,v.style.top=`${ee}px`}function $p(){let v=[["event",Me?Ft:!0,o.getElementById("memoryKindEventLabel")],["fact",Me&&Bn,o.getElementById("memoryKindFactLabel")],["schema",Me&&Fn,o.getElementById("memoryKindSchemaLabel")]];if(Me&&c.clientWidth<=900){let S=o.querySelector(".controls").getBoundingClientRect().bottom,C=Math.min(c.clientHeight-38,S+18),O={event:c.clientWidth/6,fact:c.clientWidth/2,schema:c.clientWidth*5/6};v.forEach(([k,q,$])=>{q&&($.style.display="block",Vl($,O[k],C))});return}if(v.forEach(([S,C,O])=>{C&&Ma(O,ou[S])}),Me&&Ft){let S=o.getElementById("memoryKindEventLabel"),C=S.getBoundingClientRect(),O=o.getElementById("memoryChainCard").getBoundingClientRect();C.left<O.right&&C.right>O.left&&C.top<O.bottom&&C.bottom>O.top&&Vl(S,C.left+C.width/2,O.bottom+C.height/2+8)}}function Qp(){let v=Z.target;pe.position.set(Math.round(v.x/X)*X,Math.round(v.y/X)*X,Math.round(v.z/X)*X)}function ft(){if(!D){if(Ma(o.getElementById("axisX"),Hl.axisX),Ma(o.getElementById("axisY"),Hl.axisY),Ma(o.getElementById("axisZ"),Hl.axisZ),Ve)for(let[v,S]of Object.entries(Mr))Ma(o.getElementById(v),S);at&&$p(),g.render(_,m),window.__brainPerformance.renderCount++}}function em(){D||E||(E=requestAnimationFrame(()=>{E=0,ft()}))}Z.addEventListener("change",()=>{Qp(),em()}),o.getElementById("resetBtn").addEventListener("click",()=>{m.position.set(0,2.4,44),Z.target.set(0,1.1,-.9),pe.position.set(0,0,0),Z.update(),ft()}),o.getElementById("frontBtn").addEventListener("click",()=>{m.position.set(0,2.4,44),Z.target.set(0,1.1,-.9),Z.update(),ft()}),o.getElementById("toggleLabelsBtn").addEventListener("click",()=>{hu(!Ve)}),o.getElementById("toggleRegionsBtn").addEventListener("click",()=>{lu(!w)}),o.getElementById("toggleCoreBtn").addEventListener("click",()=>{cu(!T)}),o.getElementById("toggleGridBtn").addEventListener("click",()=>{Ls(!H)}),o.getElementById("toggleNeuralBtn").addEventListener("click",()=>{Oe(!Ie)}),o.getElementById("spontaneousBtn").addEventListener("click",()=>{J("spontaneous")}),o.getElementById("frontalPulseBtn").addEventListener("click",()=>{J("prefrontal")}),o.getElementById("hippocampusPulseBtn").addEventListener("click",()=>{J("hippocampus")}),o.getElementById("globalPulseBtn").addEventListener("click",()=>{J("global")}),o.getElementById("toggleMemoryBtn").addEventListener("click",()=>{wi(!at)}),o.getElementById("memoryXrayBtn").addEventListener("click",()=>{tu(!Ge)}),o.getElementById("toggleObjectGroupingBtn").addEventListener("click",()=>{nu(!Me)}),o.getElementById("toggleEventKindBtn").addEventListener("click",()=>{Pl(!Ft)}),o.getElementById("toggleFactKindBtn").addEventListener("click",()=>{Dl(!Bn)}),o.getElementById("toggleSchemaKindBtn").addEventListener("click",()=>{Nl(!Fn)}),o.getElementById("memoryConsolidateBtn").addEventListener("click",()=>{ru("consolidate")}),o.getElementById("memoryRetrieveBtn").addEventListener("click",()=>{ru("retrieve")}),o.getElementById("memoryExampleBtn").addEventListener("click",()=>{Is(Ea,!0)}),o.getElementById("memoryNextExampleBtn").addEventListener("click",()=>{Is(Ea+1,!1)}),o.getElementById("memoryLoadMoreBtn").addEventListener("click",()=>{!Ze&&Ei&&Zp(Ei)}),o.getElementById("memoryClearExampleBtn").addEventListener("click",()=>{jp()}),r.addEventListener("resize",()=>{E&&cancelAnimationFrame(E),E=requestAnimationFrame(()=>{E=0;let v=c.clientWidth,S=c.clientHeight,C=Math.min(window.devicePixelRatio||1,p.pixelRatioCap);m.aspect=v/S,m.updateProjectionMatrix(),g.getPixelRatio()!==C&&g.setPixelRatio(C),g.setSize(v,S),Cl(),ft()})}),D=!0,hu(!0),lu(!0),cu(!1),Ls(!0),Oe(!1),J("spontaneous"),wi(!0),tu(!0),nu(!1),Pl(!0),Dl(!0),Nl(!0),Is(0,!1),D=!1,ft(),window.__canonicalSnapshotReady=Promise.resolve();let ba=g.domElement;ba.dataset.knowledgeBrainCanvas="",ba.className="eisKnowledgeBrainCanvas";let uu=ft,tm="idle",du=v=>{tm=v,ba.style.transform=v==="settling"?"scale(.15)":"scale(1)",v==="thinking"?(D=!1,Ls(!0),wi(!0),Oe(!0),uu()):v==="hero"||v==="settling"?(D=!1,Ls(!0),wi(!0),Oe(!1),uu()):(Fe(),Ht&&cancelAnimationFrame(Ht),Ht=0,D=!0)};return du("idle"),{ready:!0,canvas:ba,setMode:du,dispose(){Fe(),Ht&&cancelAnimationFrame(Ht),E&&cancelAnimationFrame(E),s.disconnect(),Z.dispose();let v=new Set;_.traverse(S=>{S.geometry&&v.add(S.geometry);for(let C of Array.isArray(S.material)?S.material:[S.material])C&&v.add(C);S.isInstancedMesh&&S.dispose()}),v.forEach(S=>S.dispose()),g.dispose(),ba.remove(),e.innerHTML=""}}}function Up(i,e=globalThis){let t="idle",n="idle",r,a=s=>{t!==s&&(t=s,i(s))};return{update(s){if(s===n)return;let o=n==="thinking";n=s,e.clearTimeout(r),o&&s==="idle"?(a("settling"),r=e.setTimeout(()=>a("idle"),680)):a(s)},dispose(){e.clearTimeout(r)}}}var p0='button[aria-label="\u505C\u6B62\u751F\u6210"],button[aria-label="Stop generating"]';function m0(i){let e=Np(i);if(!e.ready)return()=>e.dispose();let t,n=0,r=[],a,s="",o="",c=[],l=window;try{for(;l!==l.parent;)l=l.parent,c.push(l)}catch{}let h=()=>{let g=window.innerHeight,y=0,x=window;try{for(;x!==x.parent&&x.frameElement;)y+=x.frameElement.getBoundingClientRect().top,x=x.parent,g=Math.min(g,x.innerHeight-y)}catch{}return Math.max(0,Math.floor(g))},u=Up(g=>{i.dataset.brainPhase=g,e.setMode(g),t?.toggleAttribute("data-knowledge-brain-active",g==="thinking")}),d=()=>{t?.removeAttribute("data-knowledge-brain-active"),t?.removeAttribute("data-knowledge-brain-ready")},p=()=>{n=0;let g=document.querySelector(".pI_x6G_frame");if(g!==a&&(a&&(a.style.height=s,a.style.minHeight=o),a=g,s=a?.style.height||"",o=a?.style.minHeight||""),a){let Z=`${h()}px`;a.style.height!==Z&&(a.style.height=Z),a.style.minHeight!=="0px"&&(a.style.minHeight="0px")}let y=document.querySelector(".wSkVaW_root");t!==y&&(d(),t=y);let x=t?.querySelector(".wSkVaW_composerSeat"),b=t?.querySelector(".wSkVaW_body"),L=document.querySelector("[data-knowledge-session-menu]"),I=[t,x,b,L].filter(Boolean);if((I.some((Z,X)=>r[X]!==Z)||r.length!==I.length)&&(_.disconnect(),r=I,r.forEach(Z=>_.observe(Z))),!t||!x||!b){u.update("idle");return}let B=t.getBoundingClientRect(),G=b.getBoundingClientRect(),F=x.getBoundingClientRect(),j=Math.max(G.top,L?.getBoundingClientRect().bottom||0),K=Math.min(F.top-8,B.bottom),z=Math.max(0,K-j);for(let[Z,X]of Object.entries({left:B.left,top:j,width:B.width,height:z})){let Q=`${Math.round(X)}px`;i.style[Z]!==Q&&(i.style[Z]=Q)}t.setAttribute("data-knowledge-brain-ready",""),u.update(z<48||B.width<48?"idle":t.querySelector(p0)?"thinking":t.dataset.phase==="hero"?"hero":"idle")},f=()=>{n||(n=requestAnimationFrame(p))},_=new ResizeObserver(f),m=new MutationObserver(g=>{g.some(y=>!i.contains(y.target))&&f()});m.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class","style","data-phase","aria-label"]}),window.addEventListener("resize",f);for(let g of c)g.addEventListener("resize",f),g.addEventListener("scroll",f,!0);return p(),()=>{u.dispose(),cancelAnimationFrame(n),m.disconnect(),_.disconnect(),window.removeEventListener("resize",f);for(let g of c)g.removeEventListener("resize",f),g.removeEventListener("scroll",f,!0);a&&(a.style.height=s,a.style.minHeight=o),d(),e.dispose()}}return Bm(f0);})();
/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
return {...brain,apply(){}};}});
