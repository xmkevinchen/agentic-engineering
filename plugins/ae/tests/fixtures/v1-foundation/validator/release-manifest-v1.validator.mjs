"use strict";

// vendored from ajv/dist/runtime/ucs2length — see build/vendor-runtime.mjs
const __ae_vendored_ucs2length = (() => {
  // https://mathiasbynens.be/notes/javascript-encoding
  // https://github.com/bestiejs/punycode.js - punycode.ucs2.decode
  function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
          length++;
          value = str.charCodeAt(pos++);
          if (value >= 0xd800 && value <= 0xdbff && pos < len) {
              // high surrogate, and there is a next character
              value = str.charCodeAt(pos);
              if ((value & 0xfc00) === 0xdc00)
                  pos++; // low surrogate
          }
      }
      return length;
  }
  return ucs2length;
})();

export const validateReleaseManifest = validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"ae.release-manifest.v1","title":"AE installed release manifest","type":"object","additionalProperties":false,"required":["schema_version","release_id","release_version","activation_base_bundle_ref","activation_base_bundle_digest","reducer_semantics","members"],"properties":{"schema_version":{"const":"ae.release-manifest.v1"},"release_id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]{2,63}$"},"release_version":{"type":"string","pattern":"^[0-9]+\\.[0-9]+\\.[0-9]+$"},"activation_base_bundle_ref":{"$ref":"#/$defs/plugin_ref"},"activation_base_bundle_digest":{"$ref":"#/$defs/digest"},"reducer_semantics":{"type":"object","additionalProperties":false,"required":["semantics_version","reducer_digest"],"properties":{"semantics_version":{"type":"string","pattern":"^[a-z0-9.-]{1,64}$"},"reducer_digest":{"$ref":"#/$defs/digest"}}},"members":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["role","ref","raw_digest","length"],"properties":{"role":{"enum":["runtime_core","standalone_validator","active_release_bridge","schema","policy"]},"ref":{"$ref":"#/$defs/plugin_ref"},"raw_digest":{"$ref":"#/$defs/digest"},"length":{"type":"integer","minimum":0,"maximum":9007199254740991}}}}},"$defs":{"digest":{"type":"string","pattern":"^sha256:[0-9a-f]{64}$"},"plugin_ref":{"type":"string","minLength":1,"maxLength":512,"pattern":"^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"}}};
const schema32 = {"type":"string","minLength":1,"maxLength":512,"pattern":"^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"};
const schema33 = {"type":"string","pattern":"^sha256:[0-9a-f]{64}$"};
const pattern4 = new RegExp("^[a-z0-9][a-z0-9-]{2,63}$", "u");
const pattern5 = new RegExp("^[0-9]+\\.[0-9]+\\.[0-9]+$", "u");
const pattern6 = new RegExp("^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$", "u");
const pattern7 = new RegExp("^sha256:[0-9a-f]{64}$", "u");
const pattern8 = new RegExp("^[a-z0-9.-]{1,64}$", "u");
const func1 = __ae_vendored_ucs2length;

function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="ae.release-manifest.v1" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.schema_version === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "schema_version"},message:"must have required property '"+"schema_version"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.release_id === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "release_id"},message:"must have required property '"+"release_id"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.release_version === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "release_version"},message:"must have required property '"+"release_version"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.activation_base_bundle_ref === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "activation_base_bundle_ref"},message:"must have required property '"+"activation_base_bundle_ref"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.activation_base_bundle_digest === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "activation_base_bundle_digest"},message:"must have required property '"+"activation_base_bundle_digest"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.reducer_semantics === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "reducer_semantics"},message:"must have required property '"+"reducer_semantics"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
if(data.members === undefined){
const err6 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "members"},message:"must have required property '"+"members"+"'"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
for(const key0 in data){
if(!(((((((key0 === "schema_version") || (key0 === "release_id")) || (key0 === "release_version")) || (key0 === "activation_base_bundle_ref")) || (key0 === "activation_base_bundle_digest")) || (key0 === "reducer_semantics")) || (key0 === "members"))){
const err7 = {instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
}
if(data.schema_version !== undefined){
if("ae.release-manifest.v1" !== data.schema_version){
const err8 = {instancePath:instancePath+"/schema_version",schemaPath:"#/properties/schema_version/const",keyword:"const",params:{allowedValue: "ae.release-manifest.v1"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
if(data.release_id !== undefined){
let data1 = data.release_id;
if(typeof data1 === "string"){
if(!pattern4.test(data1)){
const err9 = {instancePath:instancePath+"/release_id",schemaPath:"#/properties/release_id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9][a-z0-9-]{2,63}$"},message:"must match pattern \""+"^[a-z0-9][a-z0-9-]{2,63}$"+"\""};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
}
else {
const err10 = {instancePath:instancePath+"/release_id",schemaPath:"#/properties/release_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
if(data.release_version !== undefined){
let data2 = data.release_version;
if(typeof data2 === "string"){
if(!pattern5.test(data2)){
const err11 = {instancePath:instancePath+"/release_version",schemaPath:"#/properties/release_version/pattern",keyword:"pattern",params:{pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$"},message:"must match pattern \""+"^[0-9]+\\.[0-9]+\\.[0-9]+$"+"\""};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
else {
const err12 = {instancePath:instancePath+"/release_version",schemaPath:"#/properties/release_version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
if(data.activation_base_bundle_ref !== undefined){
let data3 = data.activation_base_bundle_ref;
if(typeof data3 === "string"){
if(func1(data3) > 512){
const err13 = {instancePath:instancePath+"/activation_base_bundle_ref",schemaPath:"#/$defs/plugin_ref/maxLength",keyword:"maxLength",params:{limit: 512},message:"must NOT have more than 512 characters"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
if(func1(data3) < 1){
const err14 = {instancePath:instancePath+"/activation_base_bundle_ref",schemaPath:"#/$defs/plugin_ref/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
if(!pattern6.test(data3)){
const err15 = {instancePath:instancePath+"/activation_base_bundle_ref",schemaPath:"#/$defs/plugin_ref/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"},message:"must match pattern \""+"^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"+"\""};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
else {
const err16 = {instancePath:instancePath+"/activation_base_bundle_ref",schemaPath:"#/$defs/plugin_ref/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
if(data.activation_base_bundle_digest !== undefined){
let data4 = data.activation_base_bundle_digest;
if(typeof data4 === "string"){
if(!pattern7.test(data4)){
const err17 = {instancePath:instancePath+"/activation_base_bundle_digest",schemaPath:"#/$defs/digest/pattern",keyword:"pattern",params:{pattern: "^sha256:[0-9a-f]{64}$"},message:"must match pattern \""+"^sha256:[0-9a-f]{64}$"+"\""};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
else {
const err18 = {instancePath:instancePath+"/activation_base_bundle_digest",schemaPath:"#/$defs/digest/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
if(data.reducer_semantics !== undefined){
let data5 = data.reducer_semantics;
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
if(data5.semantics_version === undefined){
const err19 = {instancePath:instancePath+"/reducer_semantics",schemaPath:"#/properties/reducer_semantics/required",keyword:"required",params:{missingProperty: "semantics_version"},message:"must have required property '"+"semantics_version"+"'"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
if(data5.reducer_digest === undefined){
const err20 = {instancePath:instancePath+"/reducer_semantics",schemaPath:"#/properties/reducer_semantics/required",keyword:"required",params:{missingProperty: "reducer_digest"},message:"must have required property '"+"reducer_digest"+"'"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
for(const key1 in data5){
if(!((key1 === "semantics_version") || (key1 === "reducer_digest"))){
const err21 = {instancePath:instancePath+"/reducer_semantics",schemaPath:"#/properties/reducer_semantics/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
if(data5.semantics_version !== undefined){
let data6 = data5.semantics_version;
if(typeof data6 === "string"){
if(!pattern8.test(data6)){
const err22 = {instancePath:instancePath+"/reducer_semantics/semantics_version",schemaPath:"#/properties/reducer_semantics/properties/semantics_version/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9.-]{1,64}$"},message:"must match pattern \""+"^[a-z0-9.-]{1,64}$"+"\""};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
else {
const err23 = {instancePath:instancePath+"/reducer_semantics/semantics_version",schemaPath:"#/properties/reducer_semantics/properties/semantics_version/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
}
if(data5.reducer_digest !== undefined){
let data7 = data5.reducer_digest;
if(typeof data7 === "string"){
if(!pattern7.test(data7)){
const err24 = {instancePath:instancePath+"/reducer_semantics/reducer_digest",schemaPath:"#/$defs/digest/pattern",keyword:"pattern",params:{pattern: "^sha256:[0-9a-f]{64}$"},message:"must match pattern \""+"^sha256:[0-9a-f]{64}$"+"\""};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
else {
const err25 = {instancePath:instancePath+"/reducer_semantics/reducer_digest",schemaPath:"#/$defs/digest/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
}
else {
const err26 = {instancePath:instancePath+"/reducer_semantics",schemaPath:"#/properties/reducer_semantics/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
}
if(data.members !== undefined){
let data8 = data.members;
if(Array.isArray(data8)){
if(data8.length < 1){
const err27 = {instancePath:instancePath+"/members",schemaPath:"#/properties/members/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
const len0 = data8.length;
for(let i0=0; i0<len0; i0++){
let data9 = data8[i0];
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
if(data9.role === undefined){
const err28 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/required",keyword:"required",params:{missingProperty: "role"},message:"must have required property '"+"role"+"'"};
if(vErrors === null){
vErrors = [err28];
}
else {
vErrors.push(err28);
}
errors++;
}
if(data9.ref === undefined){
const err29 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/required",keyword:"required",params:{missingProperty: "ref"},message:"must have required property '"+"ref"+"'"};
if(vErrors === null){
vErrors = [err29];
}
else {
vErrors.push(err29);
}
errors++;
}
if(data9.raw_digest === undefined){
const err30 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/required",keyword:"required",params:{missingProperty: "raw_digest"},message:"must have required property '"+"raw_digest"+"'"};
if(vErrors === null){
vErrors = [err30];
}
else {
vErrors.push(err30);
}
errors++;
}
if(data9.length === undefined){
const err31 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/required",keyword:"required",params:{missingProperty: "length"},message:"must have required property '"+"length"+"'"};
if(vErrors === null){
vErrors = [err31];
}
else {
vErrors.push(err31);
}
errors++;
}
for(const key2 in data9){
if(!((((key2 === "role") || (key2 === "ref")) || (key2 === "raw_digest")) || (key2 === "length"))){
const err32 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err32];
}
else {
vErrors.push(err32);
}
errors++;
}
}
if(data9.role !== undefined){
let data10 = data9.role;
if(!(((((data10 === "runtime_core") || (data10 === "standalone_validator")) || (data10 === "active_release_bridge")) || (data10 === "schema")) || (data10 === "policy"))){
const err33 = {instancePath:instancePath+"/members/" + i0+"/role",schemaPath:"#/properties/members/items/properties/role/enum",keyword:"enum",params:{allowedValues: schema31.properties.members.items.properties.role.enum},message:"must be equal to one of the allowed values"};
if(vErrors === null){
vErrors = [err33];
}
else {
vErrors.push(err33);
}
errors++;
}
}
if(data9.ref !== undefined){
let data11 = data9.ref;
if(typeof data11 === "string"){
if(func1(data11) > 512){
const err34 = {instancePath:instancePath+"/members/" + i0+"/ref",schemaPath:"#/$defs/plugin_ref/maxLength",keyword:"maxLength",params:{limit: 512},message:"must NOT have more than 512 characters"};
if(vErrors === null){
vErrors = [err34];
}
else {
vErrors.push(err34);
}
errors++;
}
if(func1(data11) < 1){
const err35 = {instancePath:instancePath+"/members/" + i0+"/ref",schemaPath:"#/$defs/plugin_ref/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"};
if(vErrors === null){
vErrors = [err35];
}
else {
vErrors.push(err35);
}
errors++;
}
if(!pattern6.test(data11)){
const err36 = {instancePath:instancePath+"/members/" + i0+"/ref",schemaPath:"#/$defs/plugin_ref/pattern",keyword:"pattern",params:{pattern: "^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"},message:"must match pattern \""+"^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$"+"\""};
if(vErrors === null){
vErrors = [err36];
}
else {
vErrors.push(err36);
}
errors++;
}
}
else {
const err37 = {instancePath:instancePath+"/members/" + i0+"/ref",schemaPath:"#/$defs/plugin_ref/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err37];
}
else {
vErrors.push(err37);
}
errors++;
}
}
if(data9.raw_digest !== undefined){
let data12 = data9.raw_digest;
if(typeof data12 === "string"){
if(!pattern7.test(data12)){
const err38 = {instancePath:instancePath+"/members/" + i0+"/raw_digest",schemaPath:"#/$defs/digest/pattern",keyword:"pattern",params:{pattern: "^sha256:[0-9a-f]{64}$"},message:"must match pattern \""+"^sha256:[0-9a-f]{64}$"+"\""};
if(vErrors === null){
vErrors = [err38];
}
else {
vErrors.push(err38);
}
errors++;
}
}
else {
const err39 = {instancePath:instancePath+"/members/" + i0+"/raw_digest",schemaPath:"#/$defs/digest/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err39];
}
else {
vErrors.push(err39);
}
errors++;
}
}
if(data9.length !== undefined){
let data13 = data9.length;
if(!(((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13))) && (isFinite(data13)))){
const err40 = {instancePath:instancePath+"/members/" + i0+"/length",schemaPath:"#/properties/members/items/properties/length/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err40];
}
else {
vErrors.push(err40);
}
errors++;
}
if((typeof data13 == "number") && (isFinite(data13))){
if(data13 > 9007199254740991 || isNaN(data13)){
const err41 = {instancePath:instancePath+"/members/" + i0+"/length",schemaPath:"#/properties/members/items/properties/length/maximum",keyword:"maximum",params:{comparison: "<=", limit: 9007199254740991},message:"must be <= 9007199254740991"};
if(vErrors === null){
vErrors = [err41];
}
else {
vErrors.push(err41);
}
errors++;
}
if(data13 < 0 || isNaN(data13)){
const err42 = {instancePath:instancePath+"/members/" + i0+"/length",schemaPath:"#/properties/members/items/properties/length/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err42];
}
else {
vErrors.push(err42);
}
errors++;
}
}
}
}
else {
const err43 = {instancePath:instancePath+"/members/" + i0,schemaPath:"#/properties/members/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err43];
}
else {
vErrors.push(err43);
}
errors++;
}
}
}
else {
const err44 = {instancePath:instancePath+"/members",schemaPath:"#/properties/members/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err44];
}
else {
vErrors.push(err44);
}
errors++;
}
}
}
else {
const err45 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err45];
}
else {
vErrors.push(err45);
}
errors++;
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};
