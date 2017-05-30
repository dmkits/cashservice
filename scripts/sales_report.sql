	declare @Tab1 char(1), @Tab2 char(2)
	select @Tab1 = char(9), @Tab2 = char(9) + char(9)
	
	declare @UT table(
		RowID int identity, 
		XMLText varchar(8000) )

	insert into @UT(XMLText)
		select '<srv_req>'
		union all select +@Tab1+'<select from="'+ @BDATE+'" to="'+ @EDATE+'">'
	
	declare @FacID varchar(250)	 
	
	declare Rows1 cursor fast_forward FOR
	SELECT FacID 
	FROM r_Crs
--	WHERE ','+@CRIDLIST+',' like '%,'+CAST(CRID as varchar(200))+',%'
WHERE CRID in(@CRID)


	open Rows1
	fetch next from Rows1 INTO @FacID
	
	while @@fetch_status = 0 begin
		insert into @UT(XMLText) 
			select +@Tab2+ '<dev sn="'+@FacID+'"/>'
			fetch next from Rows1 INTO @FacID	
	end
	close Rows1
	deallocate Rows1
	
		insert into @UT(XMLText)
			select +@Tab1+'</select>'
			union all select '</srv_req>'

SELECT XMLText FROM @UT order by RowID