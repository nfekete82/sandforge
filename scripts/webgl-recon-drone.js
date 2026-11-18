/** R-01 lightweight reconnaissance drone. Geometry is generated locally in the
 * browser: no external asset fetch, and every rotor has an independent pivot.
 * Three.js Y is up. The simulation owns speed, flight, HP and fog of war.
 */
import * as THREE from 'three';

export function createReconDrone(owner=0){
 const drone=new THREE.Group();
 drone.name='Sandforge_R01_Recon_Drone';
 const mat=(color,metalness=.22,roughness=.77,extra={})=>
  new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
 const sand=mat('#b4a17f'),sandLight=mat('#d1bd92'),olive=mat('#7b816a'),
  brown=mat('#988065'),frame=mat('#3c4140',.55,.53),
  steel=mat('#5b605c',.62,.44),dark=mat('#262a29',.3,.64),
  lens=mat('#273645',.18,.12),glass=mat('#7893aa',.2,.09),
  team=mat(owner===1?'#be6150':'#448fa0',.2,.42),
  amber=mat('#ffc268',.12,.33,{emissive:'#bd6516',emissiveIntensity:.8});
 function part(geometry,material,name,parent=drone,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
  parent.add(mesh);return mesh;
 }
 const beam=(a,b,r,name)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);
  const delta=end.clone().sub(start);
  const mesh=part(new THREE.CylinderGeometry(r*.81,r,delta.length(),8),frame,name);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
 };
 // Lightweight exposed X frame and fragile, low-profile armored hull.
 const hull=part(new THREE.BoxGeometry(14,6,22),sand,'R01_Hull',drone,0,7,0);
 const belly=part(new THREE.BoxGeometry(12,2,17),frame,'R01_LowerFrame',drone,0,3.4,0);
 const nose=part(new THREE.ConeGeometry(7,10,4),sandLight,'R01_Nose',drone,0,7,15);
 nose.rotation.x=Math.PI/2;nose.rotation.z=Math.PI/4;
 const back=part(new THREE.BoxGeometry(12,4,7),olive,'R01_RearModule',drone,0,7,-11);
 const dorsal=part(new THREE.BoxGeometry(12.5,1.2,16),sandLight,'R01_TopPanel',drone,0,10.4,1);
 for(const [name,x,z,w,d,color,angle] of [
  ['CamoA',-3.5,4,4.7,5,olive,-.22],
  ['CamoB',3.6,-3.5,4.3,6,brown,.21],
  ['CamoC',-1.2,-5,3,3.5,olive,.1]
 ]){const patch=part(new THREE.BoxGeometry(w,.2,d),color,name,drone,x,11.1,z);patch.rotation.y=angle;}
 part(new THREE.BoxGeometry(7,.7,2.2),dark,'R01_UpperVent',drone,0,11.2,6.3);
 for(const x of [-5.5,5.5])part(new THREE.BoxGeometry(1.2,1,9),steel,'R01_DeckRib_'+x,drone,x,10.2,0);
 const rotors=[];
 for(let i=0;i<4;i++){
  const x=i%2===0?-24:24,z=i<2?21:-21;
  beam([x>0?6:-6,7,z>0?7:-7],[x,8.5,z],2.1,'R01_Arm_'+i);
  part(new THREE.CylinderGeometry(4.2,4.8,3,12),sandLight,'R01_MotorBell_'+i,drone,x,9.7,z);
  part(new THREE.CylinderGeometry(2.3,2.7,1.5,12),frame,'R01_MotorAxle_'+i,drone,x,11.5,z);
  const pivot=new THREE.Group();pivot.name='R01_Rotor_'+i;pivot.position.set(x,12.25,z);
  drone.add(pivot);rotors.push(pivot);
  const rotor=part(new THREE.BoxGeometry(2.8,.3,25),dark,'R01_Propeller_'+i,pivot);
  rotor.rotation.y=i*Math.PI/4;
  part(new THREE.CylinderGeometry(1.8,1.8,.8,10),steel,'R01_PropellerHub_'+i,pivot);
  // Thin, vulnerable motor wiring is visible on the open frame.
  part(new THREE.CylinderGeometry(.45,.45,7,6),brown,'R01_WireClamp_'+i,drone,x*.7,7,z*.7);
 }
 // Two-axis suspended camera, large dark glass lens and protective ring.
 part(new THREE.BoxGeometry(3,4,5),steel,'R01_GimbalBracket',drone,0,0.9,6);
 const gimbal=part(new THREE.SphereGeometry(5.2,14,10),sand,'R01_Camera_Gimbal',drone,0,-2.3,7.7);
 part(new THREE.CylinderGeometry(3.5,3.7,2,16),dark,'R01_LensBezel',drone,0,-2.6,12.3).rotation.x=Math.PI/2;
 part(new THREE.CylinderGeometry(2.65,2.65,.3,16),glass,'R01_Optic',drone,0,-2.6,13.5).rotation.x=Math.PI/2;
 part(new THREE.SphereGeometry(1,8,6),lens,'R01_CameraHighlight',drone,-.55,-2.2,13.75);
 part(new THREE.CylinderGeometry(.55,.65,13,8),frame,'R01_Antenna',drone,5.5,17.1,-6);
 part(new THREE.SphereGeometry(1,8,6),dark,'R01_AntennaTip',drone,5.5,24,-6);
 part(new THREE.BoxGeometry(3.8,2.5,1.2),amber,'R01_StatusLight',drone,0,6,-15);
 for(const x of [-1,1]){
  part(new THREE.BoxGeometry(1.1,1.5,8),team,'R01_Identification_'+x,drone,x*6.6,6.3,-.5);
 }
 drone.userData.rotors=rotors;
 drone.userData.reconDrone=true;
 return drone;
}

export function animateReconDrone(drone,dt=0,active=true){
 if(!active||!drone?.userData?.rotors||dt<=0)return;
 const speed=42;
 drone.userData.rotors.forEach((rotor,i)=>{
  rotor.rotation.y+=(i%2===0?1:-1)*Math.min(dt,.08)*speed;
 });
}