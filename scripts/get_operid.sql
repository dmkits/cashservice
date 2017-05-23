declare  @CRID SMALLINT
select  @CRID=c.CRID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID

select TOP 1 op.OperID
from r_OperCrs ocrs, r_Opers op
where ocrs.CrID=@CRID and op.OperId=ocrs.OperID and  op.CRAdmin>0 order by CROperID;