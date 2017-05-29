SELECT ProdName=p.ProdName,UM=sd.UM,Qty=SUM(sd.Qty), ProdPrice_wt=sd.PriceCC_wt, Sum_wt=SUM(sd.PriceCC_wt)
FROM t_Sale s
  INNER JOIN t_SaleD sd on s.CHID=sd.CHID
  INNER JOIN r_Prods p on p.ProdID=sd.ProdID
WHERE s.DocDate BETWEEN  CONVERT(SMALLDATETIME,@BDATE,101)   AND CONVERT(SMALLDATETIME,@EDATE,101)
      AND s.CRID IN (3) ----
group by p.ProdName,sd.UM,sd.PriceCC_wt