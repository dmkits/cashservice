
select cr.FacID AS CashBoxID, LTRIM(RTRIM(p.Article2)) AS ProdName, Dep=p.PGrID, p.CstProdCode AS CstProdCode, pl.PLName AS PriceName,
 Qty= ISNULL(rem.Qty,0), p.UM AS UM,  mp.PriceMC AS ProdPrice
FROM  r_Crs cr
  INNER JOIN r_Stocks st on cr.StockID=st.StockID
  INNER JOIN r_ProdMP mp on mp.PLID=st.PLID
  INNER JOIN r_Prods p on p.ProdID= mp.ProdID
  INNER JOIN r_PLs pl on pl.PLID=mp.PLID
  INNER JOIN r_CRSrvs c on c.SrvID =cr.SrvID
  LEFT JOIN t_Rem rem on rem.StockID=cr.StockID AND rem.ProdID=p.ProdID AND rem.OurID=c.OurID
  WHERE ','+@CRIDLIST+',' like '%,'+CAST(cr.CRID as varchar(200))+',%'
      AND  p.Article2 IS NOT NULL AND LTRIM(RTRIM(p.Article2))<>''
GROUP BY cr.FacID,p.Article2,p.PGrID,p.CstProdCode,pl.PLName,rem.Qty, p.UM, mp.PriceMC;
