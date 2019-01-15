
declare  @CRID INT, @OurID INT, @StockID INT

-- select  @CRID=c.CRID, @OurID = r.OurID
-- from r_Crs c
-- INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
-- WHERE c.FacID=@FacID


select @CRID=cr.CRID, @StockID=cr.StockID,@OurID=crsrv.OurID
from r_Crs cr,r_CRSrvs crsrv
WHERE cr.FacID=@FacID  and crsrv.SrvID=cr.SrvID

select ChID from t_sale
where OurID=@OurID AND CRID=@CRID AND StockID=@StockID AND IntDocID=@DocID AND DocDate=@DocDate;
