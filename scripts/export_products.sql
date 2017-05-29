
	declare @UT table(
		RowID int identity,
		XMLText varchar(8000) )

	insert into @UT(XMLText)
		select '<?xml version="1.0" encoding="UTF-8"?>'
		union all select '<IMPORT since="20101229173500>'
		union all select '<LIST>'
		union all select '</DEVICES>'


	declare @FacID varchar(250)
	declare RowsDevices cursor fast_forward FOR
	SELECT FacID
	FROM r_Crs
--	WHERE ','+@CRIDLIST+',' like '%,'+CAST(CRID as varchar(200))+',%'
 WHERE CRID in (@CRID);

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


	declare @ProdName varchar(250), @ProdPrice varchar(250)
	declare RowsItems cursor fast_forward FOR
	SELECT mp.PriceMC,p.ProdName
	FROM r_CRs cr
	INNER JOIN r_Stocks st on st.StockID=cr.StockID
	INNER JOIN r_ProdMP mp on mp.PLID=st.PLID
	INNER JOIN r_Prods p on p.ProdID=mp.ProdID
	WHERE cr.CRID IN (@CRID)

	open RowsItems
	fetch next from RowsItems INTO @ProdPrice,@ProdName

	while @@fetch_status = 0 begin
		insert into @UT(XMLText)
			select  '<ITEM  price="'+ @ProdPrice+'>'+ @ProdName+'</ITEM>'
			fetch next from RowsItems INTO @ProdPrice,@ProdName
	end
	close RowsItems
	deallocate RowsItems

		insert into @UT(XMLText)
		  select '/<ITEMS>'
			union all select '</LIST>'
			union all select '</IMPORT>'

SELECT XMLText FROM @UT order by RowID


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