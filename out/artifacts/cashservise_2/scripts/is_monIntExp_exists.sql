
declare  @CRID INT, @OurID INT

select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID

select *
from t_MonIntExp
where DocDate=@DocDate AND SumCC=@SumCC