
	declare @UT table(
		RowID int identity,
		XMLText varchar(8000) )

	insert into @UT(XMLText)
		select '<?xml version="1.0" encoding="windows-1251"?>'
		union all select '<IMPORT since="20101229173500">'   --20150211140000???
		union all select '<LIST>'
		union all select '<DEVICES>'


	declare @FacID varchar(250)
	declare RowsDevices cursor fast_forward FOR
	SELECT FacID
	FROM r_Crs
	WHERE ','+@CRIDLIST+',' like '%,'+CAST(CRID as varchar(200))+',%'
 --WHERE CRID in (@CRID);

	open RowsDevices
	fetch next from RowsDevices INTO @FacID

	while @@fetch_status = 0 begin
		insert into @UT(XMLText)
			select  '<DEVICE id="'+@FacID+'"/>'                       --<DEVICE id="..." />
			fetch next from RowsDevices INTO @FacID
	end
	close RowsDevices
	deallocate RowsDevices
insert into @UT(XMLText)
			select '</DEVICES>'
		  union all select '<ITEMS>'


	declare @ProdID INT, @ProdName varchar(250),@BarCode varchar(250), @ProdPrice INT, @Qty NUMERIC
	declare RowsItems cursor fast_forward FOR
	SELECT p.ProdID,mp.PriceMC,  ISNULL(rem.Qty,0) , mq.BarCode, p.ProdName
	FROM r_CRs cr
	INNER JOIN r_Stocks st on st.StockID=cr.StockID
	INNER JOIN r_ProdMP mp on mp.PLID=st.PLID
	INNER JOIN r_Prods p on p.ProdID=mp.ProdID
	INNER JOIN r_ProdMQ mq on mq.ProdID=p.ProdID AND mq.UM=p.UM
	INNER JOIN r_CRSrvs rvs on rvs.SrvID =cr.SrvID
  LEFT JOIN t_Rem rem on rem.StockID=cr.StockID AND rem.ProdID=p.ProdID AND rem.OurID=rvs.OurID

WHERE ','+@CRIDLIST+',' like '%,'+CAST(cr.CRID  as varchar(200))+',%'
	open RowsItems
	fetch next from RowsItems INTO @ProdID,@ProdPrice,@Qty,@BarCode,@ProdName

	while @@fetch_status = 0 begin
		insert into @UT(XMLText)
			select  --'<ITEM  price="'+ @ProdPrice+'>'+ @ProdName+'</ITEM>'
			'<ITEM code="'+CAST(@ProdID as varchar)+'" price="'+CAST(@ProdPrice*100 as varchar)+'" quantity="'+CAST(@Qty as varchar)+'" tax="1" barcode="'+@BarCode+'" divisibility="1" ctrl_qnt="0">'+ @ProdName+'</ITEM>'
			fetch next from RowsItems INTO @ProdID, @ProdPrice,@Qty, @BarCode, @ProdName
	end
	close RowsItems
	deallocate RowsItems

		insert into @UT(XMLText)
		  select '</ITEMS>'
			union all select '</LIST>'
			union all select '</IMPORT>'

SELECT XMLText FROM @UT order by RowID




--            <ITEM code="00175" price="2000" quantity="9999999" tax="1" barcode="8693855001005" divisibility="1" ctrl_qnt="0">FRESH LIMONLU SODA</ITEM>
-- <?xml version="1.0" encoding="UTF-8"?>
-- <IMPORT since="20101229173500">
-- <LIST>
-- <DEVICES>
-- <DEVICE id="ПБ4101100567" />
-- <DEVICE id="ПБ57506761#" />
-- ...
-- <DEVICE id="LD51005678" />
-- </DEVICES>
-- <ITEMS>
-- ... перечень товаров ...
-- </ITEMS>
-- </LIST>
-- <LIST>
-- ...
-- </LIST>
-- ...
-- <LIST>
-- ...
-- </LIST>
-- </IMPORT>