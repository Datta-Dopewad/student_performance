import { database } from './_lib/db.mjs';
import { auth,asObjectId,idString } from './_lib/security.mjs';
import { methodNotAllowed,send } from './_lib/http.mjs';

const latestAssessment=(schoolId,as='a')=>({$lookup:{
  from:'student_assessments',let:{sid:'$_id'},as,
  pipeline:[
    {$match:{$expr:{$and:[{$eq:['$studentId','$$sid']},{$eq:['$schoolId',schoolId]}]}}},
    {$sort:{assessmentDate:-1,createdAt:-1}},{$limit:1}
  ]
}});

export default async function handler(req,res){
  try{
    if(req.method!=='GET')return methodNotAllowed(res,['GET']);
    const user=await auth(req,res);if(!user)return;
    const db=await database(),classId=asObjectId(req.query.classId),match={schoolId:user.schoolId,active:true};
    if(classId)match.classId=classId;
    const threshold=Number(user.atRiskThreshold??60),high=Math.max(threshold,70),excellentThreshold=Math.max(threshold,85);
    const summaryAgg=await db.collection('students').aggregate([
      {$match:match},latestAssessment(user.schoolId),
      {$unwind:{path:'$a',preserveNullAndEmptyArrays:true}},
      {$addFields:{average:{$cond:[{$eq:['$a',null]},null,{$divide:[{$add:['$a.previousMarks','$a.assignmentScore']},2]}]}}},
      {$group:{
        _id:null,total:{$sum:1},average:{$avg:'$average'},attendance:{$avg:'$attendancePct'},
        at_risk:{$sum:{$cond:[{$and:[{$ne:['$average',null]},{$lt:['$average',threshold]}]},1,0]}},
        excellent:{$sum:{$cond:[{$and:[{$ne:['$average',null]},{$gte:['$average',excellentThreshold]}]},1,0]}},
        good:{$sum:{$cond:[{$and:[{$ne:['$average',null]},{$gte:['$average',high]},{$lt:['$average',85]}]},1,0]}},
        average_group:{$sum:{$cond:[{$and:[{$ne:['$average',null]},{$gte:['$average',threshold]},{$lt:['$average',70]}]},1,0]}}
      }}
    ]).toArray();
    const recentRaw=await db.collection('students').aggregate([
      {$match:match},{$sort:{updatedAt:-1}},{$limit:5},
      {$lookup:{from:'classes',localField:'classId',foreignField:'_id',as:'classDoc'}},
      {$unwind:{path:'$classDoc',preserveNullAndEmptyArrays:true}},
      latestAssessment(user.schoolId),{$unwind:{path:'$a',preserveNullAndEmptyArrays:true}},
      {$project:{
        _id:0,id:{$toString:'$_id'},name:'$fullName',roll:'$rollNumber',class:'$classDoc.name',
        attendance:'$attendancePct',average:{$cond:[{$eq:['$a',null]},null,{$divide:[{$add:['$a.previousMarks','$a.assignmentScore']},2]}]},
        subjectId:'$a.subjectId'
      }}
    ]).toArray();
    const trendMatch={schoolId:user.schoolId,assessmentDate:{$exists:true}};
    const trend=await db.collection('student_assessments').aggregate([
      {$match:trendMatch},
      {$lookup:{from:'students',let:{sid:'$studentId'},pipeline:[
        {$match:{$expr:{$and:[{$eq:['$_id','$$sid']},{$eq:['$schoolId',user.schoolId]},{$eq:['$active',true]},...(classId?[{$eq:['$classId',classId]}]:[])]}}},
        {$project:{_id:1}}
      ],as:'student'}},{$match:{'student.0':{$exists:true}}},
      {$project:{assessmentDate:1,average:{$divide:[{$add:['$previousMarks','$assignmentScore']},2]}}},
      {$group:{_id:{$dateToString:{format:'%Y-%m',date:'$assessmentDate'}},label:{$first:{$dateToString:{format:'%b',date:'$assessmentDate'}}},sortDate:{$min:'$assessmentDate'},average:{$avg:'$average'}}},
      {$sort:{sortDate:-1}},{$limit:8},{$sort:{sortDate:1}}
    ]).toArray();
    const subjectIds=[...new Set(recentRaw.map(x=>idString(x.subjectId)).filter(Boolean))].map(asObjectId);
    const subjects=await db.collection('subjects').find({_id:{$in:subjectIds},schoolId:user.schoolId}).toArray();
    const subMap=new Map(subjects.map(x=>[idString(x._id),x.name]));
    const recent=recentRaw.map(x=>({id:x.id,name:x.name,roll:x.roll,class:x.class,attendance:x.attendance,average:x.average,subject:subMap.get(idString(x.subjectId))||''}));
    const activity=await db.collection('audit_logs').find({schoolId:user.schoolId}).sort({createdAt:-1}).limit(6).project({action:1,entityType:1,createdAt:1}).toArray();
    const summary=summaryAgg[0]||{total:0,average:0,attendance:0,at_risk:0,excellent:0,good:0,average_group:0};
    return send(res,200,{summary,recent,activity,trend:trend.map(t=>({label:t.label,average:t.average}))});
  }catch(error){console.error('dashboard_error',error.code||500);return send(res,500,{error:'Unable to load the school dashboard.'})}
}
