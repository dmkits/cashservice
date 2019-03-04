declare @UT table(
	RowID int identity,
	XMLText varchar(8000),
	noProdName bit DEFAULT 0)

insert into @UT(XMLText)
	select '<?xml version="1.0" encoding="windows-1251"?>'
	union all select '<IMPORT since="'+@CurrentDateTime+'">'   --20150211140000??? 20101229173500
	union all select '<LIST>'
	union all select '<DEVICES>'

declare @FacID varchar(250)
declare RowsDevices cursor fast_forward FOR
	SELECT FacID
	FROM r_Crs
	WHERE ','+@CRIDLIST+',' like '%,'+CAST(CRID as varchar(200))+',%'
open RowsDevices
fetch next from RowsDevices INTO @FacID
while @@fetch_status = 0 begin
	insert into @UT(XMLText)
		select  '<DEVICE id="'+@FacID+'"/>'
	fetch next from RowsDevices INTO @FacID
end
close RowsDevices
deallocate RowsDevices

insert into @UT(XMLText)
	select '</DEVICES>'
	union all select '<ITEMS>'

declare @ProdID INT, @ProdName varchar(250),@BarCode varchar(250), @ProdPrice NUMERIC(21,9), @Qty NUMERIC(21,9),@divValue bit, @PGrID INT, @noProdName bit
declare RowsItems cursor fast_forward FOR
SELECT
   	CASE WHEN mp.Notes IS NULL THEN  p.ProdID
		WHEN LTRIM(RTRIM(mp.Notes))='' THEN p.ProdID
		WHEN CAST (mp.Notes AS INTEGER)IS NOT NULL THEN  CAST (mp.Notes AS INTEGER)
		ELSE  p.ProdID END
	,mp.PriceMC,  SUM(ISNULL(rem.Qty,0)),
	 divValue=
	 CASE WHEN LOWER(LTRIM(p.UM)) like 'л%' THEN 1
	     WHEN LOWER(LTRIM(p.UM)) like 'кг%' THEN 1
	     ELSE 0 END
	 ,mq.BarCode, p.Article2, p.PGrID
	,noProdName= CASE When p.Article2 IS NULL OR LTRIM(p.Article2)='' Then 1 Else 0 END
FROM r_CRs cr
INNER JOIN r_Stocks st on st.StockID=cr.StockID
INNER JOIN r_ProdMP mp on mp.PLID=st.PLID
INNER JOIN r_Prods p on p.ProdID=mp.ProdID
INNER JOIN r_ProdMQ mq on mq.ProdID=p.ProdID AND mq.UM=p.UM
INNER JOIN r_CRSrvs rvs on rvs.SrvID =cr.SrvID
LEFT JOIN t_Rem rem on rem.StockID=cr.StockID AND rem.ProdID=p.ProdID AND rem.OurID=rvs.OurID
WHERE ','+@CRIDLIST+',' like '%,'+CAST(cr.CRID  as varchar(200))+',%'
	AND mp.PriceMC>0
GROUP BY 
	CASE WHEN mp.Notes IS NULL THEN  p.ProdID
		WHEN LTRIM(RTRIM(mp.Notes))='' THEN p.ProdID
		WHEN CAST (mp.Notes AS INTEGER)IS NOT NULL THEN  CAST (mp.Notes AS INTEGER)
		ELSE  p.ProdID END
	,mp.PriceMC,  mq.BarCode, p.Article2, p.PGrID, p.UM
ORDER BY
	CASE
		WHEN mp.Notes IS NULL THEN  p.ProdID
		WHEN LTRIM(RTRIM(mp.Notes))='' THEN p.ProdID
		WHEN CAST (mp.Notes AS INTEGER)IS NOT NULL THEN  CAST (mp.Notes AS INTEGER)
	ELSE  p.ProdID END asc;

open RowsItems
fetch next from RowsItems INTO @ProdID,@ProdPrice,@Qty,@divValue,@BarCode,@ProdName,@PGrID, @noProdName
while @@fetch_status = 0 begin
	insert into @UT(XMLText, noProdName)
	select  --'<ITEM  price="'+ @ProdPrice+'>'+ @ProdName+'</ITEM>'
		'<ITEM code="'+CAST(@ProdID as varchar)+'" price="'+CAST(CAST(@ProdPrice*100 as int)as varchar)+'" quantity="'
		+CAST(CAST(@Qty*1000 as int) as varchar)+'" tax="1" barcode="'+@BarCode+'" department="'+CAST(@PGrID as varchar)+'" divisibility="'+CAST(@divValue as varchar)+'" ctrl_qnt="0">'
		+ @ProdName+'</ITEM>', @noProdName
	fetch next from RowsItems INTO @ProdID, @ProdPrice,@Qty,@divValue, @BarCode, @ProdName,@PGrID, @noProdName
end
close RowsItems
deallocate RowsItems

insert into @UT(XMLText)
	select '</ITEMS>'
	union all select '</LIST>'
	union all select '</IMPORT>'

SELECT XMLText,noProdName  FROM @UT order by RowID;