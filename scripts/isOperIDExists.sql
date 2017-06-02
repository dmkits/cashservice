select o.OperID from  r_OperCrs o
inner join r_CRs cr on o.CRID=cr.CRID
WHERE cr.FacID=@FacID AND o.CROperID = @CROperID