import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
config({path:'.env.local'});
const uri=process.env.MONGODB_URI,dbName=process.env.MONGODB_DB||'student_performanceDB';
if(!uri)throw new Error('Set MONGODB_URI before running the database setup.');
const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000,appName:'student-performance-migrations'});
const definitions={
  schools:{bsonType:'object',required:['name','academicYear','createdAt','updatedAt'],properties:{name:{bsonType:'string',minLength:1,maxLength:160},academicYear:{bsonType:'string'},atRiskThreshold:{bsonType:['int','double','long','decimal']},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'}}},
  users:{bsonType:'object',required:['schoolId','name','email','passwordHash','role','active','createdAt','updatedAt'],properties:{schoolId:{bsonType:'objectId'},name:{bsonType:'string',minLength:1,maxLength:160},email:{bsonType:'string'},passwordHash:{bsonType:'string'},role:{enum:['school_admin','teacher','viewer']},active:{bsonType:'bool'},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'},lastLoginAt:{bsonType:['date','null']}}},
  classes:{bsonType:'object',required:['schoolId','name','academicYear','createdAt'],properties:{schoolId:{bsonType:'objectId'},name:{bsonType:'string'},grade:{bsonType:['string','null']},academicYear:{bsonType:'string'},createdAt:{bsonType:'date'}}},
  subjects:{bsonType:'object',required:['schoolId','name','createdAt'],properties:{schoolId:{bsonType:'objectId'},name:{bsonType:'string'},createdAt:{bsonType:'date'}}},
  students:{bsonType:'object',required:['schoolId','classId','rollNumber','fullName','attendancePct','weeklyStudyHours','active','createdAt','updatedAt'],properties:{schoolId:{bsonType:'objectId'},classId:{bsonType:'objectId'},rollNumber:{bsonType:'string'},fullName:{bsonType:'string',minLength:1,maxLength:160},attendancePct:{bsonType:['int','long','double','decimal']},weeklyStudyHours:{bsonType:['int','long','double','decimal']},active:{bsonType:'bool'},createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'},archivedAt:{bsonType:['date','null']}}}
};
try{await client.connect();const db=client.db(dbName);for(const [name,validator] of Object.entries(definitions)){try{await db.createCollection(name,{validator:{$jsonSchema:validator},validationLevel:'strict',validationAction:'error'})}catch(e){if(e.code!==48)throw e;await db.command({collMod:name,validator:{$jsonSchema:validator},validationLevel:'strict',validationAction:'error'})}}
 const indexes={
  schools:[],users:[[{email:1},{unique:true,name:'users_email_unique'}],[{schoolId:1,role:1,active:1},{name:'users_school_role_active'}]],
  classes:[[{schoolId:1,name:1,academicYear:1},{unique:true,name:'classes_school_name_year_unique'}]],subjects:[[{schoolId:1,name:1},{unique:true,name:'subjects_school_name_unique'}]],
  students:[[{schoolId:1,rollNumber:1},{unique:true,name:'students_school_roll_unique'}],[{schoolId:1,active:1,fullName:1},{name:'students_school_active_name'}],[{schoolId:1,classId:1,active:1},{name:'students_school_class'}]],
  student_assessments:[[{schoolId:1,studentId:1,assessmentDate:-1},{name:'assessments_school_student_date'}],[{schoolId:1,subjectId:1,term:1},{name:'assessments_school_subject_term'}]],
  predictions:[[{schoolId:1,generatedAt:-1},{name:'predictions_school_time'}],[{schoolId:1,studentId:1,generatedAt:-1},{name:'predictions_school_student_time'}]],
  imports:[[{schoolId:1,createdAt:-1},{name:'imports_school_time'}]],audit_logs:[[{schoolId:1,createdAt:-1},{name:'audit_school_time'}]],
  sessions:[[{tokenHash:1},{unique:true,name:'sessions_token_unique'}],[{userId:1},{name:'sessions_user'}],[{expiresAt:1},{expireAfterSeconds:0,name:'sessions_expiry_ttl'}]],
  login_attempts:[[{keyHash:1,attemptedAt:-1},{name:'login_attempts_key_time'}],[{attemptedAt:1},{expireAfterSeconds:86400,name:'login_attempts_ttl'}]]
 };
 for(const [collection,specs] of Object.entries(indexes))if(specs.length)await db.collection(collection).createIndexes(specs.map(([key,options])=>({key, ...options})));
 await db.collection('schema_migrations').updateOne({_id:'001_initial'},{ $setOnInsert:{appliedAt:new Date(),version:1}},{upsert:true});
 console.log('MongoDB collections and indexes are ready.');
}finally{await client.close()}
