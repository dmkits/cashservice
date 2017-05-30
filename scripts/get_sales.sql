SELECT cr.FacID AS CashBoxID,s.DocDate AS Date,s.DocID AS ChequeNumber,sd.SrcPosID AS PosNumber,
ProdName=p.Article2,Article1=p.Article1,UM=sd.UM,Qty=SUM(sd.Qty), ProdPrice_wt=sd.PriceCC_wt, Sum_wt=SUM(sd.PriceCC_wt)
FROM t_Sale s
  INNER JOIN t_SaleD sd on s.CHID=sd.CHID
  INNER JOIN r_Prods p on p.ProdID=sd.ProdID
  INNER JOIN r_CRs cr on cr.CRID=s.CRID
WHERE s.DocDate BETWEEN  CONVERT(SMALLDATETIME,@BDATE,101)   AND CONVERT(SMALLDATETIME,@EDATE,101)
      AND s.CRID IN (@CRID)
group by cr.FacID,s.DocDate, s.DocID,sd.SrcPosID, p.Article2,p.Article1, sd.UM,sd.PriceCC_wt
ORDER BY s.DocDate, s.DocID,sd.SrcPosID