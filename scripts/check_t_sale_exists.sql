

select s.ChID from t_sale s
INNER JOIN r_CRs c ON c.CRID=s.CRID
where /*c.FacID=@FacID and*/ s.DocID=@DocId;
