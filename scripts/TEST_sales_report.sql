	declare @Tab1 char(1), @Tab2 char(2)
	select @Tab1 = char(9), @Tab2 = char(9) + char(9)
	
	declare @UT table(
		RowID int identity, 
		XMLText varchar(8000) )

	insert into @UT(XMLText)
	--	select '<?xml version="1.0" encoding="windows-1251"?>'
		select '<srv_req>'
		union all select +@Tab1+'<select from="201704130000" to="201704272359">'
	
	declare @FacID varchar(250)	 

		insert into @UT(XMLText) 
			select +@Tab2+ '<dev sn="4101213753"/>'

		insert into @UT(XMLText)
			select +@Tab1+'</select>'
			union all select '</srv_req>'

SELECT XMLText FROM @UT order by RowID